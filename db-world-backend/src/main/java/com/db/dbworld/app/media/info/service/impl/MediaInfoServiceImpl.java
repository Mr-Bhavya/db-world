package com.db.dbworld.app.media.info.service.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.dto.MediaFileStatsDto;
import com.db.dbworld.app.media.info.dto.MediaFileSummaryDto;
import com.db.dbworld.app.media.info.dto.TrackDto;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.entity.track.*;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.storyboard.StoryboardService;
import com.db.dbworld.app.stream.tag.MediaTagResolver;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class MediaInfoServiceImpl implements MediaInfoService {

    private final ProcessExecutor processExecutor;
    private final MediaFileRepository mediaFileRepository;
    private final RecordRepository recordRepository;
    private final ObjectMapper objectMapper;
    private final AppProperties properties;
    private final StoryboardService storyboardService;

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public MediaFileDto collectAndPersist(Path filePath, Long recordId, String ingestionJobId) {
        log.debug("collectAndPersist filePath={} recordId={} ingestionJobId={}",
                filePath, recordId, ingestionJobId);
        String json = getRawJson(filePath);

        // Replace any existing entry for this path (avoids duplicates). Carry the scrub-preview
        // storyboard forward so a re-collect/rescan doesn't drop the thumbnail: stash the sprite
        // before the delete (whose @PostRemove would erase it), copy the geometry onto the new
        // row, then restore the sprite under the new id. A full re-ingest still regenerates it.
        Path stashedSprite = null;
        Integer sbIntervalMs = null, sbCols = null, sbRows = null, sbTileW = null, sbTileH = null, sbCount = null;
        var existingOpt = mediaFileRepository.findByFilePath(filePath.toAbsolutePath().toString());
        if (existingOpt.isPresent()) {
            MediaFileEntity existing = existingOpt.get();
            log.info("Replacing existing MediaInfo entry for {} (id={})",
                    filePath.getFileName(), existing.getId());
            if (existing.getStoryboardCount() != null) {
                sbIntervalMs = existing.getStoryboardIntervalMs();
                sbCols       = existing.getStoryboardCols();
                sbRows       = existing.getStoryboardRows();
                sbTileW      = existing.getStoryboardTileW();
                sbTileH      = existing.getStoryboardTileH();
                sbCount      = existing.getStoryboardCount();
                stashedSprite = storyboardService.stashSprite(existing.getId());
            }
            mediaFileRepository.delete(existing);
        }

        MediaFileEntity entity = buildEntity(filePath, json, recordId, ingestionJobId);
        if (sbCount != null) {
            entity.setStoryboardIntervalMs(sbIntervalMs);
            entity.setStoryboardCols(sbCols);
            entity.setStoryboardRows(sbRows);
            entity.setStoryboardTileW(sbTileW);
            entity.setStoryboardTileH(sbTileH);
            entity.setStoryboardCount(sbCount);
        }
        MediaFileEntity saved = mediaFileRepository.save(entity);
        if (stashedSprite != null) storyboardService.restoreSprite(stashedSprite, saved.getId());

        log.info("MediaInfo persisted: id={}, file={}, tracks={}, recordId={}",
                saved.getId(), filePath.getFileName(), saved.getTracks().size(), recordId);

        return toDto(saved);
    }

    @Override
    @Transactional
    public MediaFileDto rescan(String mediaFileId) {
        log.debug("rescan mediaFileId={}", mediaFileId);
        MediaFileEntity existing = mediaFileRepository.findById(mediaFileId)
                .orElseThrow(() -> new IllegalArgumentException("MediaFile not found: " + mediaFileId));

        Path filePath = Path.of(existing.getFilePath());
        Long recordId = existing.getRecord() != null ? existing.getRecord().getId() : null;
        String jobId = existing.getIngestionJobId();

        // Don't delete here — collectAndPersist replaces the existing row for this path and carries
        // the storyboard forward. Deleting first would drop the scrub preview.
        log.info("Rescan re-collecting path={} (id={})", filePath, mediaFileId);
        return collectAndPersist(filePath, recordId, jobId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaFileDto> getByRecordId(Long recordId) {
        return mediaFileRepository.findByRecord_Id(recordId).stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MediaFileDto> getById(String id) {
        return mediaFileRepository.findById(id).map(this::toDto);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MediaFileDto> getByFilePath(String filePath) {
        // Tolerant lookup — `findByFilePath` returns Optional<> and Spring Data
        // throws IncorrectResultSizeDataAccessException when the DB happens to
        // hold duplicate rows for the same path (a buggy ingestion run can
        // produce them). Fall back to the list variant and take the newest.
        try {
            return mediaFileRepository.findByFilePath(filePath).map(this::toDto);
        } catch (IncorrectResultSizeDataAccessException e) {
            List<MediaFileEntity> dupes = mediaFileRepository.findAllByFilePath(filePath);
            log.warn("getByFilePath: {} duplicate rows for path {} — returning newest",
                    dupes.size(), filePath);
            return dupes.stream()
                    .max(Comparator.comparing(MediaFileEntity::getCreatedAt))
                    .map(this::toDto);
        }
    }

    @Override
    @Transactional
    public void deleteByFilePath(String filePath) {
        log.info("deleteByFilePath path={}", filePath);
        // Two race scenarios this method has to survive:
        //  1. Admin HTTP delete and FileWatcherService's OS-event handler
        //     fire on the same path concurrently. Hibernate cascades through
        //     `tracks` (cascade=ALL + orphanRemoval), so whichever transaction
        //     commits second tries to DELETE FROM media_tracks WHERE id=? for
        //     rows the first tx already removed, gets row-count 0, and throws
        //     StaleObjectStateException.
        //  2. Multiple MediaFile rows exist for the same filePath (legacy data
        //     from the torrent-metadata-confused-as-payload bug). Spring
        //     Data's `deleteByFilePath` loads all matches and cascades each;
        //     pre-loading with our list variant gives us per-entity
        //     control + a clear log line.
        List<MediaFileEntity> matches = mediaFileRepository.findAllByFilePath(filePath);
        if (matches.isEmpty()) {
            log.debug("deleteByFilePath: nothing to delete (already gone) — {}", filePath);
            return;
        }
        if (matches.size() > 1) {
            log.warn("deleteByFilePath: {} duplicate rows for path {} — deleting all",
                    matches.size(), filePath);
        }
        for (MediaFileEntity entity : matches) {
            try {
                mediaFileRepository.delete(entity);
            } catch (ObjectOptimisticLockingFailureException e) {
                log.debug("deleteByFilePath: row id={} concurrently deleted (race) — {}",
                        entity.getId(), filePath);
            }
        }
    }

    @Override
    @Transactional
    public void deleteByRecordId(Long recordId) {
        log.info("deleteByRecordId recordId={}", recordId);
        mediaFileRepository.deleteAllByRecord_Id(recordId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MediaFileDto> findAll() {
        return mediaFileRepository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<MediaFileSummaryDto> getPagedSummary(String q, Boolean linked, String sort, int page, int size) {
        Sort jpaSort = switch (sort != null ? sort : "newest") {
            case "oldest"    -> Sort.by("createdAt").ascending();
            case "largest"   -> Sort.by("fileSize").descending();
            case "smallest"  -> Sort.by("fileSize").ascending();
            case "name-asc"  -> Sort.by("fileName").ascending();
            case "name-desc" -> Sort.by("fileName").descending();
            default          -> Sort.by("createdAt").descending();
        };

        PageRequest pageable = PageRequest.of(page, size, jpaSort);
        String qParam = (q != null && !q.isBlank()) ? q.strip() : null;

        Page<String> idPage;
        if (linked == null) {
            idPage = mediaFileRepository.findIdsByQ(qParam, pageable);
        } else if (linked) {
            idPage = mediaFileRepository.findLinkedIdsByQ(qParam, pageable);
        } else {
            idPage = mediaFileRepository.findUnlinkedIdsByQ(qParam, pageable);
        }

        if (!idPage.hasContent()) {
            return Page.empty(pageable);
        }

        List<MediaFileEntity> entities = mediaFileRepository.findAllByIdIn(idPage.getContent());
        Map<String, MediaFileEntity> byId = entities.stream()
                .collect(Collectors.toMap(MediaFileEntity::getId, Function.identity()));

        List<MediaFileSummaryDto> summaries = idPage.getContent().stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .map(this::toSummaryDto)
                .toList();

        return new PageImpl<>(summaries, pageable, idPage.getTotalElements());
    }

    @Override
    @Transactional(readOnly = true)
    public MediaFileStatsDto getStats() {
        long total  = mediaFileRepository.countTotal();
        long linked = mediaFileRepository.countLinked();
        return MediaFileStatsDto.builder()
                .total(total)
                .linked(linked)
                .unlinked(total - linked)
                .totalSize(mediaFileRepository.sumFileSize())
                .hdrCount(mediaFileRepository.countHdr())
                .uhdCount(mediaFileRepository.countUhd())
                .build();
    }

    private MediaFileSummaryDto toSummaryDto(MediaFileEntity entity) {
        MediaFileSummaryDto.MediaFileSummaryDtoBuilder b = MediaFileSummaryDto.builder()
                .id(entity.getId())
                .recordId(entity.getRecord() != null ? entity.getRecord().getId() : null)
                .fileName(entity.getFileName())
                .filePath(entity.getFilePath())
                .fileSize(entity.getFileSize())
                .mimeType(entity.getMimeType())
                .ingestionJobId(entity.getIngestionJobId())
                .tmdbSeasonNumber(entity.getTmdbSeasonNumber())
                .tmdbEpisodeNumber(entity.getTmdbEpisodeNumber())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt());

        VideoTrackEntity primaryVideo = null;
        AudioTrackEntity primaryAudio = null;
        GeneralTrackEntity general    = null;
        int videoCount = 0, audioCount = 0, textCount = 0;

        for (TrackEntity t : entity.getTracks()) {
            if (t instanceof GeneralTrackEntity g) {
                general = g;
            } else if (t instanceof VideoTrackEntity v) {
                videoCount++;
                boolean vHasFps = v.getFrameRate() != null && !v.getFrameRate().isBlank();
                if (primaryVideo == null) {
                    primaryVideo = v;
                } else {
                    boolean pHasFps = primaryVideo.getFrameRate() != null && !primaryVideo.getFrameRate().isBlank();
                    int vH = v.getHeight() != null ? v.getHeight() : -1;
                    int pH = primaryVideo.getHeight() != null ? primaryVideo.getHeight() : -1;
                    if ((vHasFps && !pHasFps) || (vHasFps == pHasFps && vH > pH)) {
                        primaryVideo = v;
                    }
                }
            } else if (t instanceof AudioTrackEntity a) {
                audioCount++;
                if (primaryAudio == null ||
                    ("yes".equalsIgnoreCase(a.getDefaultTrack()) && !"yes".equalsIgnoreCase(primaryAudio.getDefaultTrack()))) {
                    primaryAudio = a;
                }
            } else if (t instanceof TextTrackEntity) {
                textCount++;
            }
        }

        if (general != null) {
            b.duration(general.getDuration())
             .videoCount(general.getVideoCount() != null ? general.getVideoCount() : videoCount)
             .audioCount(general.getAudioCount() != null ? general.getAudioCount() : audioCount)
             .textCount(general.getTextCount()  != null ? general.getTextCount()  : textCount);
        } else {
            b.videoCount(videoCount).audioCount(audioCount).textCount(textCount);
        }

        if (primaryVideo != null) {
            b.videoHeight(primaryVideo.getHeight())
             .videoWidth(primaryVideo.getWidth())
             .videoCodec(primaryVideo.getFormat())
             .hdrFormat(primaryVideo.getHdrFormat())
             .frameRate(primaryVideo.getFrameRate())
             .videoBitRate(primaryVideo.getBitRate());
        }

        if (primaryAudio != null) {
            b.audioFormat(primaryAudio.getFormat())
             .audioChannels(primaryAudio.getChannels())
             .audioLanguage(primaryAudio.getLanguage());
        }

        return b.build();
    }

    @Override
    @Transactional
    public MediaFileDto updateEpisodeNumbers(String id, Integer season, Integer episode) {
        MediaFileEntity entity = mediaFileRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("MediaFile not found: " + id));
        entity.setTmdbSeasonNumber(season);
        entity.setTmdbEpisodeNumber(episode);
        return toDto(mediaFileRepository.save(entity));
    }

    @Override
    public String getRawJson(Path filePath) {
        try {
            return processExecutor.runMediaInfoCommand(filePath);
        } catch (Exception e) {
            log.warn("MediaInfo probe failed for path={}: {}", filePath, e.getMessage(), e);
            throw new RuntimeException("MediaInfo failed: " + e.getMessage(), e);
        }
    }

    @Transactional(readOnly = true)
    @Override
    public MediaFileDto collectMediaInfo(Path filePath) {
        String json = getRawJson(filePath);

        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode tracks = root.path("media").path("track");

            List<TrackDto> trackDtos = new ArrayList<>();

            if (tracks.isArray()) {
                int order = 0;

                for (JsonNode node : tracks) {
                    String type = node.path("@type").asText("");

                    TrackDto dto = mapTrackToDto(type, node, order++);
                    if (dto != null) trackDtos.add(dto);
                }
            }

            return MediaFileDto.builder()
                    .fileName(filePath.getFileName().toString())
                    .filePath(toRelativePath(filePath))
                    .fileSize(Files.exists(filePath) ? Files.size(filePath) : null)
                    .tracks(trackDtos)
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("Failed to parse MediaInfo JSON", e);
        }
    }

    private String toRelativePath(Path filePath) {

        Path absolute = filePath.toAbsolutePath().normalize();

        Path streamRoot = properties.getStreamPath().toAbsolutePath().normalize();
        Path externalRoot = properties.getExternalVideosPath().toAbsolutePath().normalize();

        Path relative;

        if (absolute.startsWith(streamRoot)) {
            relative = streamRoot.relativize(absolute);
        } else if (absolute.startsWith(externalRoot)) {
            relative = externalRoot.relativize(absolute);
        } else {
            throw new RuntimeException("File outside allowed directories: " + absolute);
        }

        return "/" + relative.toString().replace("\\", "/");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Entity builder
    // ──────────────────────────────────────────────────────────────────────────

    private MediaFileEntity buildEntity(Path filePath, String json, Long recordId, String ingestionJobId) {
        MediaFileEntity entity = new MediaFileEntity();
        entity.setFilePath(filePath.toAbsolutePath().toString());
        entity.setFileName(filePath.getFileName().toString());
        entity.setIngestionJobId(ingestionJobId);
        entity.setRawMediaInfoJson(json);

        try {
            entity.setFileSize(Files.size(filePath));
        } catch (Exception ignored) {}

        if (recordId != null) {
            recordRepository.findById(recordId).ifPresent(entity::setRecord);
        }

        parseTracksInto(entity, json);

        return entity;
    }

    private void parseTracksInto(MediaFileEntity entity, String json) {
        try {
            JsonNode root = objectMapper.readTree(json);
            JsonNode tracks = root.path("media").path("track");

            if (!tracks.isArray()) {
                log.warn("MediaInfo JSON has no track array for {}", entity.getFileName());
                return;
            }

            int streamOrder = 0;
            for (JsonNode trackNode : tracks) {
                String type = trackNode.path("@type").asText("");
                TrackEntity track = buildTrack(type, trackNode, streamOrder++);
                if (track != null) entity.addTrack(track);
            }
        } catch (Exception e) {
            log.warn("Failed to parse MediaInfo JSON for {}: {}", entity.getFileName(), e.getMessage(), e);
        }
    }

    private TrackEntity buildTrack(String type, JsonNode node, int order) {
        String extraJson = node.toString();

        return switch (type) {
            case "General" -> {
                GeneralTrackEntity t = new GeneralTrackEntity();
                t.setStreamOrder(order);
                t.setExtraJson(extraJson);
                t.setFormat(text(node, "Format"));
                t.setFormatVersion(text(node, "Format_Version"));
                t.setFileSize(longVal(node, "FileSize"));
                t.setDuration(parseDurationMs(node, "Duration"));
                t.setOverallBitRate(longVal(node, "OverallBitRate"));
                t.setVideoCount(intVal(node, "VideoCount"));
                t.setAudioCount(intVal(node, "AudioCount"));
                t.setTextCount(intVal(node, "TextCount"));
                t.setFileExtension(text(node, "FileExtension"));
                t.setTitle(text(node, "Title"));
                t.setEncodedApplication(text(node, "Encoded_Application"));
                t.setEncodedDate(text(node, "Encoded_Date"));
                yield t;
            }
            case "Video" -> {
                VideoTrackEntity t = new VideoTrackEntity();
                t.setStreamOrder(order);
                t.setExtraJson(extraJson);
                t.setFormat(text(node, "Format"));
                t.setCodecId(text(node, "CodecID"));
                t.setProfile(text(node, "Format_Profile"));
                t.setWidth(intVal(node, "Width"));
                t.setHeight(intVal(node, "Height"));
                t.setDisplayAspectRatio(text(node, "DisplayAspectRatio_String"));
                t.setFrameRate(text(node, "FrameRate"));
                t.setBitRate(longVal(node, "BitRate"));
                t.setBitDepth(intVal(node, "BitDepth"));
                t.setColorSpace(text(node, "ColorSpace"));
                t.setHdrFormat(text(node, "HDR_Format"));
                t.setHdrFormatCompatibility(text(node, "HDR_Format_Compatibility"));
                t.setDuration(parseDurationMs(node, "Duration"));
                t.setStreamSize(longVal(node, "StreamSize"));
                t.setDefaultTrack(text(node, "Default"));
                t.setForced(text(node, "Forced"));
                yield t;
            }
            case "Audio" -> {
                AudioTrackEntity t = new AudioTrackEntity();
                t.setStreamOrder(order);
                t.setExtraJson(extraJson);
                t.setFormat(text(node, "Format"));
                t.setFormatCommercial(text(node, "Format_Commercial_IfAny"));
                t.setCodecId(text(node, "CodecID"));
                t.setLanguage(resolveLanguage(text(node, "Language")));
                t.setTitle(text(node, "Title"));
                t.setChannels(intVal(node, "Channels"));
                t.setChannelLayout(text(node, "ChannelLayout"));
                t.setSamplingRate(longVal(node, "SamplingRate"));
                t.setBitRate(longVal(node, "BitRate"));
                t.setBitRateMode(text(node, "BitRate_Mode"));
                t.setCompressionMode(text(node, "Compression_Mode"));
                t.setDuration(parseDurationMs(node, "Duration"));
                t.setStreamSize(longVal(node, "StreamSize"));
                t.setDefaultTrack(text(node, "Default"));
                t.setForced(text(node, "Forced"));
                yield t;
            }
            case "Text" -> {
                TextTrackEntity t = new TextTrackEntity();
                t.setStreamOrder(order);
                t.setExtraJson(extraJson);
                t.setFormat(text(node, "Format"));
                t.setCodecId(text(node, "CodecID"));
                t.setLanguage(resolveLanguage(text(node, "Language")));
                t.setTitle(text(node, "Title"));
                t.setDefaultTrack(text(node, "Default"));
                t.setForced(text(node, "Forced"));
                t.setStreamSize(longVal(node, "StreamSize"));
                t.setFrameRate(text(node, "FrameRate"));
                t.setFrameCount(longVal(node, "FrameCount"));
                yield t;
            }
            case "Image" -> {
                ImageTrackEntity t = new ImageTrackEntity();
                t.setStreamOrder(order);
                t.setExtraJson(extraJson);
                t.setFormat(text(node, "Format"));
                t.setWidth(intVal(node, "Width"));
                t.setHeight(intVal(node, "Height"));
                t.setTitle(text(node, "Title"));
                t.setStreamSize(longVal(node, "StreamSize"));
                // Derive MIME type from format
                String fmt = text(node, "Format");
                if (fmt != null) {
                    t.setMimeType(fmt.equalsIgnoreCase("PNG") ? "image/png" : "image/jpeg");
                }
                t.setSource("EMBEDDED");
                yield t;
            }
            default -> {
                log.debug("Skipping unsupported track type: {}", type);
                yield null;
            }
        };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // DTO mapper
    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public MediaFileDto toDto(MediaFileEntity entity) {
        List<TrackDto> trackDtos = entity.getTracks().stream()
                .map(this::toTrackDto)
                .toList();

        return MediaFileDto.builder()
                .id(entity.getId())
                .recordId(entity.getRecord() != null ? entity.getRecord().getId() : null)
                .fileName(entity.getFileName())
                .filePath(entity.getFilePath())
                .fileSize(entity.getFileSize())
                .mimeType(entity.getMimeType())
                .ingestionJobId(entity.getIngestionJobId())
                .tmdbSeasonNumber(entity.getTmdbSeasonNumber())
                .tmdbEpisodeNumber(entity.getTmdbEpisodeNumber())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .storyboardIntervalMs(entity.getStoryboardIntervalMs())
                .storyboardCols(entity.getStoryboardCols())
                .storyboardRows(entity.getStoryboardRows())
                .storyboardTileW(entity.getStoryboardTileW())
                .storyboardTileH(entity.getStoryboardTileH())
                .storyboardCount(entity.getStoryboardCount())
                .tracks(trackDtos)
                .build();
    }

    @SuppressWarnings("unchecked")
    private TrackDto toTrackDto(TrackEntity track) {
        // getTrackType() reads from the discriminator column which is insertable=false/updatable=false —
        // it is only populated when Hibernate reads the entity back from DB.
        // For newly persisted (not re-fetched) entities it is null, so we derive the type
        // from the class hierarchy to ensure getPrimaryVideoTrack() etc. always work.
        String trackType;
        if      (track instanceof VideoTrackEntity)   trackType = "Video";
        else if (track instanceof AudioTrackEntity)   trackType = "Audio";
        else if (track instanceof TextTrackEntity)    trackType = "Text";
        else if (track instanceof ImageTrackEntity)   trackType = "Image";
        else if (track instanceof GeneralTrackEntity) trackType = "General";
        else                                          trackType = track.getTrackType();

        TrackDto.TrackDtoBuilder b = TrackDto.builder()
                .type(trackType)
                .streamOrder(track.getStreamOrder());

        // Parse extra JSON for the `extra` map
        Map<String, Object> extra = null;
        try {
            if (track.getExtraJson() != null) {
                extra = objectMapper.readValue(track.getExtraJson(), Map.class);
            }
        } catch (Exception ignored) {}

        b.rawMediaInfo(extra);

        if (track instanceof GeneralTrackEntity g) {
            b.format(g.getFormat())
             .fileSize(g.getFileSize())
             .duration(g.getDuration())
             .overallBitRate(g.getOverallBitRate())
             .videoCount(g.getVideoCount())
             .audioCount(g.getAudioCount())
             .textCount(g.getTextCount());
        } else if (track instanceof VideoTrackEntity v) {
            b.format(v.getFormat())
             .width(v.getWidth())
             .height(v.getHeight())
             .frameRate(v.getFrameRate())
             .bitRate(v.getBitRate())
             .bitDepth(v.getBitDepth())
             .colorSpace(v.getColorSpace())
             .hdrFormat(v.getHdrFormat())
             .hdrFormatCompatibility(v.getHdrFormatCompatibility())
             .duration(v.getDuration())
             .defaultTrack(v.getDefaultTrack())
             .forced(v.getForced());
        } else if (track instanceof AudioTrackEntity a) {
            b.format(a.getFormat())
             .language(a.getLanguage())
             .title(a.getTitle())
             .channels(a.getChannels())
             .samplingRate(a.getSamplingRate())
             .bitRate(a.getBitRate())
             .duration(a.getDuration())
             .defaultTrack(a.getDefaultTrack())
             .forced(a.getForced());
        } else if (track instanceof TextTrackEntity t) {
            b.format(t.getFormat())
             .language(t.getLanguage())
             .title(t.getTitle())
             .defaultTrack(t.getDefaultTrack())
             .forced(t.getForced());
        } else if (track instanceof ImageTrackEntity img) {
            b.format(img.getFormat())
             .width(img.getWidth())
             .height(img.getHeight())
             .title(img.getTitle())
             .mimeType(img.getMimeType())
             .source(img.getSource())
             .tmdbPosterPath(img.getTmdbPosterPath());
        }

        return b.build();
    }

    private TrackDto mapTrackToDto(String type, JsonNode node, int order) {
        Map extra = objectMapper.convertValue(node, Map.class);

        TrackDto.TrackDtoBuilder b = TrackDto.builder()
                .type(type)
                .streamOrder(order)
                .rawMediaInfo(extra);

        switch (type) {

            case "General" -> {
                b.format(text(node, "Format"))
                        .fileSize(longVal(node, "FileSize"))
                        .duration(parseDurationMs(node, "Duration"))
                        .overallBitRate(longVal(node, "OverallBitRate"))
                        .videoCount(intVal(node, "VideoCount"))
                        .audioCount(intVal(node, "AudioCount"))
                        .textCount(intVal(node, "TextCount"));
            }

            case "Video" -> {
                b.format(text(node, "Format"))
                        .width(intVal(node, "Width"))
                        .height(intVal(node, "Height"))
                        .frameRate(text(node, "FrameRate"))
                        .bitRate(longVal(node, "BitRate"))
                        .bitDepth(intVal(node, "BitDepth"))
                        .colorSpace(text(node, "ColorSpace"))
                        .hdrFormat(text(node, "HDR_Format"))
                        .hdrFormatCompatibility(text(node, "HDR_Format_Compatibility"))
                        .duration(parseDurationMs(node, "Duration"))
                        .defaultTrack(text(node, "Default"))
                        .forced(text(node, "Forced"));
            }

            case "Audio" -> {
                b.format(text(node, "Format"))
                        .language(resolveLanguage(text(node, "Language")))
                        .title(text(node, "Title"))
                        .channels(intVal(node, "Channels"))
                        .samplingRate(longVal(node, "SamplingRate"))
                        .bitRate(longVal(node, "BitRate"))
                        .duration(parseDurationMs(node, "Duration"))
                        .defaultTrack(text(node, "Default"))
                        .forced(text(node, "Forced"));
            }

            case "Text" -> {
                b.format(text(node, "Format"))
                        .language(resolveLanguage(text(node, "Language")))
                        .title(text(node, "Title"))
                        .defaultTrack(text(node, "Default"))
                        .forced(text(node, "Forced"));
            }

            case "Image" -> {
                b.format(text(node, "Format"))
                        .width(intVal(node, "Width"))
                        .height(intVal(node, "Height"))
                        .title(text(node, "Title"));
            }

            default -> {
                return null;
            }
        }

        return b.build();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // JSON extraction helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String text(JsonNode node, String field) {
        JsonNode n = node.get(field);
        return (n != null && !n.isNull()) ? n.asText(null) : null;
    }

    private Long longVal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        if (n == null || n.isNull()) return null;
        try { return n.asLong(); } catch (Exception e) { return null; }
    }

    private Integer intVal(JsonNode node, String field) {
        JsonNode n = node.get(field);
        if (n == null || n.isNull()) return null;
        try { return n.asInt(); } catch (Exception e) { return null; }
    }

    private String resolveLanguage(String raw) {
        if (raw == null) return null;
        String resolved = MediaTagResolver.resolveLanguage(raw);
        return "Unknown".equalsIgnoreCase(resolved) ? raw : resolved;
    }

    /**
     * MediaInfo reports Duration as floating-point seconds in JSON.
     * Convert to milliseconds for storage.
     */
    private Long parseDurationMs(JsonNode node, String field) {
        JsonNode n = node.get(field);
        if (n == null || n.isNull()) return null;
        try {
            double seconds = Double.parseDouble(n.asText());
            return (long) (seconds * 1000);
        } catch (Exception e) {
            return null;
        }
    }
}
