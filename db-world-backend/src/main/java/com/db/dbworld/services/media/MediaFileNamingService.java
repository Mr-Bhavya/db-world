package com.db.dbworld.services.media;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.entities.dbcinema.tmdb.MovieTmdbDataEntity;
import com.db.dbworld.entities.dbcinema.tmdb.SeriesTmdbDataEntity;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.media.resolver.MediaTagResolver;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.PathSanitizer;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.containsIgnoreCase;

/**
 * @deprecated File naming logic superseded by
 * {@link com.db.dbworld.app.cinema.tmdb.ingestion.impl.TmdbIngestionServiceImpl}
 * and {@link com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService}.
 * Still referenced by old MediaFileUtils and MediaFileHandler until those are removed.
 */
@Deprecated(forRemoval = true)
@Log4j2
@Service
public class MediaFileNamingService {

    @Autowired
    private ObjectMapper objectMapper;

// Movie:  Title.Year.Resolution.Source.SourceType.VideoCodec.HDR.BitDepth.Language.AudioCodec.Channels.Extension
// Series: Title.SxxEyy.Resolution.Source.SourceType.VideoCodec.HDR.BitDepth.Language.AudioCodec.Channels.Extension

    public String buildFileNameAndPath(MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfoEntity) {
        StringBuilder sb = new StringBuilder();
        DBCinemaRecordsEntity record = fileDetails.getDbCinemaRecordsEntity();
        String recordType = record.getType();

        if (DbWorldConstants.RECORD_TYE.MOVIE.name().equalsIgnoreCase(recordType)) buildMovieFileName(sb, fileDetails, mediaFileInfoEntity);
        else if (DbWorldConstants.RECORD_TYE.SERIES.name().equalsIgnoreCase(recordType)) buildSeriesFileName(fileDetails, sb, mediaFileInfoEntity);

        appendFileExtension(sb, fileDetails, mediaFileInfoEntity);
        return PathSanitizer.sanitizeFilename(sb.toString());
    }

    public String buildFileNameAndPath(MediaFileDetails fileDetails, String json) {
        MediaFileInfoEntity mediaFileInfoEntity = parseMediaInfoJson(fileDetails, json).getFirst();
        return buildFileNameAndPath(fileDetails, mediaFileInfoEntity);
    }

    // ================= MOVIE =================

    public void buildMovieFileName(StringBuilder sb, MediaFileDetails fileDetails, MediaFileInfoEntity entity) {
        sb.append(normalizeTitle(fileDetails.getName()));
        sb.append(".").append(getYearInfo(fileDetails.getDbCinemaRecordsEntity())); // movie year
        appendVideoInfo(sb, entity, fileDetails);
        appendAudioInfo(sb, entity);
    }

    // ================= SERIES =================

    public void buildSeriesFileName(MediaFileDetails fileDetails, StringBuilder sb, MediaFileInfoEntity entity) {
        sb.append(normalizeTitle(fileDetails.getName())).append(".").append(fileDetails.getSeason()).append(fileDetails.getEpisode());
        appendVideoInfo(sb, entity, fileDetails);
        appendAudioInfo(sb, entity);
    }

    // ================= VIDEO =================

    private void appendVideoInfo(StringBuilder sb, MediaFileInfoEntity entity, MediaFileDetails fileDetails) {
        Optional<VideoInfoEntity> videoInfoOpt = getFirstVideoTrack(entity);
        if (videoInfoOpt.isPresent()) {
            VideoInfoEntity v = videoInfoOpt.get();
            appendResolutionInfo(sb, v);
            appendSourceInfo(sb, fileDetails.getOrgFileName());
            appendCodecInfo(sb, v);
            appendHdrInfo(sb, v);
            appendBitInfo(sb, v);
        }
    }

    public Optional<VideoInfoEntity> getFirstVideoTrack(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream().filter(VideoInfoEntity.class::isInstance).map(VideoInfoEntity.class::cast).findFirst();
    }

    public void appendResolutionInfo(StringBuilder sb, VideoInfoEntity v) {
        int height = v.getHeight();
        if (height <= 0) return;
        var entry = MediaTagResolver.RESOLUTION_BUCKETS.floorEntry(height);
        sb.append(".").append(entry.getValue());
    }

    public void appendCodecInfo(StringBuilder sb, VideoInfoEntity v) {
        String tag = MediaTagResolver.resolveVideoCodec(v.getFormat());
        if (tag != null) sb.append(".").append(tag);
        else if (v.getFormat() != null) sb.append(".").append(sanitize(v.getFormat()));
    }

    public void appendHdrInfo(StringBuilder sb, VideoInfoEntity v) {
        String tag = MediaTagResolver.resolveHdr(v.getHdrFormat());
        if (tag != null && !containsIgnoreCase(sb, "hdr")) sb.append(".").append(tag);
    }

    public void appendBitInfo(StringBuilder sb, VideoInfoEntity v) {
        Integer bitDepth = v.getBitDepth();
        if (bitDepth == null) return;
        String tag = MediaTagResolver.BIT_DEPTH_MAP.get(bitDepth);
        if (tag != null) sb.append(".").append(tag);
    }

    // ================= SOURCE =================

    private void appendSourceInfo(StringBuilder sb, String filename) {
        MediaSource source = MediaTagResolver.detectSource(filename);
        if (source == MediaSource.UNKNOWN) return;
        if (!source.getLabel().isEmpty())
            sb.append(".").append(source.getLabel());
        if (!source.getDefaultType().isEmpty())
            sb.append(".").append(source.getDefaultType());
    }


    // ================= AUDIO =================

    public void appendAudioInfo(StringBuilder sb, MediaFileInfoEntity entity) {
        List<AudioInfoEntity> audioTracks = getAudioTracks(entity);
        if (!audioTracks.isEmpty()) {
            if (audioTracks.size() == 1) sb.append(".").append(formatAudioInfo(audioTracks.getFirst()));
            else if (audioTracks.size() == 2) sb.append(".").append(formatAudioInfo(audioTracks.get(0))).append("+").append(formatAudioInfo(audioTracks.get(1)));
            else sb.append(".MULTI");
        }
    }

    public List<AudioInfoEntity> getAudioTracks(MediaFileInfoEntity entity) {
        return entity.getTrackInfos().stream().filter(AudioInfoEntity.class::isInstance).map(AudioInfoEntity.class::cast).collect(Collectors.toList());
    }

    public String formatAudioInfo(AudioInfoEntity audio) {
        StringBuilder sb = new StringBuilder();
        String languageCode = audio.getLanguage();
        if (languageCode != null && !languageCode.isBlank() && !"und".equalsIgnoreCase(languageCode)) {
            String language = MediaTagResolver.LANGUAGE_MAP.getOrDefault(languageCode.toLowerCase(), languageCode.toUpperCase());
            sb.append(language).append(".");
        }

        String combined = safe(audio.getFormatCommercialIfAny()) + " " + safe(audio.getFormat()) + " " + safe(audio.getCodecID());
        String codec = MediaTagResolver.resolveAudioCodec(combined);
        if (codec != null) sb.append(codec);
        else if (!combined.isBlank()) sb.append(sanitize(combined));

        Integer channels = audio.getChannels();
        if (channels != null) sb.append(".").append(MediaTagResolver.CHANNEL_MAP.getOrDefault(channels, channels + "ch"));
        return sb.toString().replace(" ", "").trim();
    }

    // ================= EXTENSION =================

    public void appendFileExtension(StringBuilder sb, MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfo) {
        Optional.ofNullable(mediaFileInfo).flatMap(this::getExtensionFromMediaFileInfo)
                .or(() -> Optional.ofNullable(fileDetails).map(MediaFileDetails::getStreamFilePath).flatMap(this::getExtensionFromFileName))
                .ifPresent(sb::append);
    }

    public Optional<String> getExtensionFromMediaFileInfo(MediaFileInfoEntity mediaFileInfo) {
        return Optional.ofNullable(mediaFileInfo).map(MediaFileInfoEntity::getTrackInfos).stream().flatMap(Collection::stream)
                .filter(GeneralInfoEntity.class::isInstance).map(GeneralInfoEntity.class::cast).findFirst()
                .map(GeneralInfoEntity::getFormat).flatMap(this::getExtensionFromFormat);
    }

    public Optional<String> getExtensionFromFileName(String fileName) {
        if (fileName == null) return Optional.empty();
        int lastDotIndex = fileName.lastIndexOf('.');
        if (lastDotIndex > 0 && lastDotIndex < fileName.length() - 1) return Optional.of(fileName.substring(lastDotIndex).toLowerCase());
        return Optional.empty();
    }

    public Optional<String> getExtensionFromFormat(String format) {
        if (format == null || format.isBlank()) return Optional.empty();
        return findExtensionForFormat(format.toLowerCase().trim());
    }

    public Optional<String> findExtensionForFormat(String format) {
        String exact = MediaTagResolver.FORMAT_EXTENSION_MAP.get(format);
        if (exact != null) return Optional.of(exact);
        for (var entry : MediaTagResolver.FORMAT_EXTENSION_MAP.entrySet()) {
            if (format.contains(entry.getKey())) return Optional.of(entry.getValue());
        }
        return Optional.empty();
    }

    // ================= YEAR =================

    public String getYearInfo(DBCinemaRecordsEntity record) {
        if (record != null && record.getTmdb() != null) {
            if (record.getTmdb() instanceof MovieTmdbDataEntity movie) {
                if (movie.getRelease_date() != null && movie.getRelease_date().length() >= 4) return movie.getRelease_date().substring(0, 4);
            } else if (record.getTmdb() instanceof SeriesTmdbDataEntity series) {
                if (series.getFirst_air_date() != null && series.getFirst_air_date().length() >= 4) return series.getFirst_air_date().substring(0, 4);
            }
        }
        return "";
    }

    // ================= JSON =================

    public List<MediaFileInfoEntity> parseMediaInfoJson(MediaFileDetails fileDetails, String jsonOutput) {
        log.debug("MediaInfo Json: {}", jsonOutput);
        try {
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();
            if (jsonElement.isJsonArray()) jsonElement.getAsJsonArray().forEach(element -> mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, element.getAsJsonObject())));
            else if (jsonElement.isJsonObject()) mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, jsonElement.getAsJsonObject()));
            return mediaFileInfos.stream().peek(mediaFileInfo -> mediaFileInfo.initialize(fileDetails.getDbCinemaRecordsEntity())).toList();
        } catch (Exception ex) {
            throw new DbWorldException("Error parsing media info JSON", ex);
        }
    }

    private MediaFileInfoEntity jsonObjectToMediaFileInfoEntity(MediaFileDetails fileDetails, JsonObject jsonObject) {
        try {
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);
            if (fileDetails.getRecordId() != null) entity = entity.initialize(fileDetails.getDbCinemaRecordsEntity());
            return entity;
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", fileDetails.getRecordId(), e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: " + fileDetails.getRecordId(), e);
        }
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfoEntity.class);
        if (mediaFileInfo == null) throw new DbWorldException("Media file details could not be retrieved from JSON");
        return mediaFileInfo;
    }

    // ================= HELPERS =================

    private String sanitize(String raw) {
        return raw.chars().filter(Character::isLetterOrDigit).collect(StringBuilder::new, StringBuilder::appendCodePoint, StringBuilder::append).toString().toUpperCase();
    }

    private String normalizeTitle(String name) {
        if (name == null) return "";
        return name.trim()
                .replaceAll("\\s+", ".")     // spaces → dot
                .replaceAll("[^a-zA-Z0-9.]", ""); // remove unsafe chars
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }
}
