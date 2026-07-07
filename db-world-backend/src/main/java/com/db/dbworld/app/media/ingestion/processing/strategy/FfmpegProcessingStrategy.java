package com.db.dbworld.app.media.ingestion.processing.strategy;

import com.db.dbworld.app.media.enrichment.SmartTrackFilterService;
import com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService;
import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.dto.TrackDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.ProcessingResult;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.spi.ProcessingStrategy;
import com.db.dbworld.app.media.ingestion.tracking.FileSubStep;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.app.cinema.catalog.tags.services.NewContentTaggingService;
import com.db.dbworld.app.media.link.SymlinkService;
import com.db.dbworld.app.media.storyboard.StoryboardService;
import com.db.dbworld.app.stream.tag.MediaSource;
import com.db.dbworld.app.stream.tag.MediaTagResolver;
import com.db.dbworld.utils.PathSanitizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Moves the downloaded file from temp to the final directory, then:
 *  1. Embeds TMDB cover art (poster / episode still) via FFmpeg
 *  2. Renames the file for TV series: {Title}.S{SS}E{EE}.{EpisodeName}.{ext}
 *  3. Sets FFmpeg metadata title (episode name for series, movie title for films)
 *  4. Collects and persists MediaInfo metadata via MediaInfoService
 *
 * Order = 10 → runs after ExtractionProcessingStrategy (Order = 1).
 */
@Log4j2
@Component
@Order(10)
@RequiredArgsConstructor
public class FfmpegProcessingStrategy implements ProcessingStrategy {
    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("(?i)[._ -]S(\\d{2})E(\\d{2})(?:[._ -]|$)");
    private static final Set<String> MEDIA_EXTENSIONS = Set.of(
            "mkv", "mp4", "avi", "mov", "ts", "m2ts", "m4v", "wmv", "flv", "webm", "mpg", "mpeg"
    );
    private final FileStorageService         fileStorageService;
    private final MediaInfoService           mediaInfoService;
    private final TmdbMediaEnrichmentService enrichmentService;
    private final SymlinkService             symlinkService;
    private final SmartTrackFilterService    smartTrackFilterService;
    private final StoryboardService          storyboardService;
    private final NewContentTaggingService   newContentTaggingService;
    private final TrackingService            trackingService;

    @Override
    public boolean supports(IngestionContext ctx) {
        return ctx.getDownload() != null && ctx.getDownload().isSuccess()
                && ctx.getDownload().getFilePath() != null;
    }

    @Override
    public ProcessingResult process(IngestionContext ctx) {
        log.debug("[{}] FfmpegProcessingStrategy.process — sourceFile={}",
                ctx.getJobId(),
                ctx.getDownload() != null ? ctx.getDownload().getFilePath() : null);
        ProcessingResult result = new ProcessingResult();
        try {
            Path sourceFile = ctx.getDownload().getFilePath();
            if (sourceFile == null) {
                result.setSuccess(false);
                result.setErrorMessage("Source file path is null");
                return result;
            }
            // After ZIP extraction the path is a directory — process every media file inside
            if (Files.isDirectory(sourceFile)) {
                return processDirectory(ctx, sourceFile);
            }
            if (!Files.exists(sourceFile)) {
                result.setSuccess(false);
                result.setErrorMessage("Downloaded temp file not found: " + sourceFile);
                return result;
            }
            trackingService.initFiles(ctx.getJobId(), List.of(sourceFile.getFileName().toString()));
            ProcessingResult single = processSingleFile(ctx, sourceFile, 1);
            trackingService.finishFile(ctx.getJobId(), 1, single.isSuccess());
            return single;
        } catch (IOException e) {
            log.error("[{}] FfmpegProcessingStrategy failed: {}", ctx.getJobId(), e.getMessage());
            ctx.logError("FFMPEG", "Failed: " + e.getMessage());
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            return result;
        }
    }

    // ── Multi-file: after ZIP/RAR extraction ─────────────────────────────────

    private ProcessingResult processDirectory(IngestionContext ctx, Path dir) throws IOException {
        List<Path> mediaFiles;
        try (var stream = Files.walk(dir)) {
            mediaFiles = stream
                    .filter(Files::isRegularFile)
                    .filter(p -> MEDIA_EXTENSIONS.contains(extension(p.getFileName().toString()).toLowerCase(Locale.ROOT)))
                    .sorted()
                    .collect(Collectors.toList());
        }

        if (mediaFiles.isEmpty()) {
            ProcessingResult result = new ProcessingResult();
            result.setSuccess(false);
            result.setErrorMessage("No media files found in extracted directory: " + dir);
            return result;
        }

        Integer originalSeason  = ctx.getRequest().getSeason();
        Integer originalEpisode = ctx.getRequest().getEpisode();

        // Partition: episode files carry a detectable SxxExx pattern; everything else
        // is an extra/sample/featurette.
        List<Path> episodeFiles = mediaFiles.stream()
                .filter(f -> detectFromFilename(f) != null)
                .collect(Collectors.toList());

        List<Path> toProcess;
        boolean perFileEpisode;
        if (!episodeFiles.isEmpty()) {
            // Season pack (one or more episodes): process each detected episode with its
            // OWN season/episode, ignoring any single value on the request; skip files
            // without an SxxExx pattern so samples/extras don't collide or mis-tag.
            toProcess = episodeFiles;
            perFileEpisode = true;
            int skipped = mediaFiles.size() - episodeFiles.size();
            if (skipped > 0) {
                ctx.log("FFMPEG", "Skipping " + skipped + " non-episode file(s) without an SxxExx pattern");
            }
        } else {
            // No episodes detected → single title (movie / single file). Pick the largest
            // media file so a bundled "sample" clip is ignored, keeping the user's
            // season/episode (if any) for that one file.
            Path main = mediaFiles.stream()
                    .max(Comparator.comparingLong(this::sizeQuietly))
                    .orElse(mediaFiles.getFirst());
            toProcess = List.of(main);
            perFileEpisode = false;
            if (mediaFiles.size() > 1) {
                ctx.log("FFMPEG", "No SxxExx episodes detected — processing largest file: " + main.getFileName());
            }
        }

        ctx.log("FFMPEG", "Processing " + toProcess.size() + " of " + mediaFiles.size() + " media file(s)");

        // Register the files up front so the UI can render the full per-file breakdown
        // (N of M) immediately, before any single file starts processing.
        trackingService.initFiles(ctx.getJobId(),
                toProcess.stream().map(p -> p.getFileName().toString()).collect(Collectors.toList()));

        Path lastFinalFile = null;
        Map<String, Object> lastMediaInfo = null;
        int successCount = 0;
        int fileIndex = 0;

        for (Path file : toProcess) {
            fileIndex++;
            if (perFileEpisode) {
                EpisodeRef ref = detectFromFilename(file); // non-null by construction
                ctx.getRequest().setSeason(ref.season());
                ctx.getRequest().setEpisode(ref.episode());
            }

            ctx.log("FFMPEG", "Processing (" + fileIndex + "/" + toProcess.size() + "): " + file.getFileName());
            try {
                ProcessingResult fileResult = processSingleFile(ctx, file, fileIndex);
                trackingService.finishFile(ctx.getJobId(), fileIndex, fileResult.isSuccess());
                if (fileResult.isSuccess()) {
                    lastFinalFile = fileResult.getFinalFile();
                    lastMediaInfo = fileResult.getMediaInfo();
                    successCount++;
                } else {
                    ctx.logError("FFMPEG", "Failed on " + file.getFileName() + ": " + fileResult.getErrorMessage());
                }
            } catch (Exception e) {
                trackingService.finishFile(ctx.getJobId(), fileIndex, false);
                ctx.logError("FFMPEG", "Error on " + file.getFileName() + ": " + e.getMessage());
            }

            // Restore original request values for the next iteration
            ctx.getRequest().setSeason(originalSeason);
            ctx.getRequest().setEpisode(originalEpisode);
        }

        ProcessingResult result = new ProcessingResult();
        if (successCount == 0) {
            result.setSuccess(false);
            result.setErrorMessage("No media files were processed successfully in " + dir);
        } else {
            result.setFinalFile(lastFinalFile);
            result.setMediaInfo(lastMediaInfo);
            result.setSuccess(true);
            ctx.log("FFMPEG", "Completed: " + successCount + "/" + toProcess.size() + " file(s) processed");
        }
        return result;
    }

    private long sizeQuietly(Path p) {
        try { return Files.size(p); } catch (IOException e) { return 0L; }
    }

    // ── Single-file processing ────────────────────────────────────────────────

    private ProcessingResult processSingleFile(IngestionContext ctx, Path sourceFile, int fileIndex) throws IOException {
        ProcessingResult result = new ProcessingResult();

        // ── 1. Stage file in temp working directory ────────────────────
        Path workingFile = stageForProcessing(ctx, sourceFile);

        // ── 2. TMDB enrichment: cover art + series naming + metadata ───
        trackingService.startFileSubStep(ctx.getJobId(), fileIndex, FileSubStep.FFMPEG);
        Path stagedFile = enrichWithTmdb(ctx, workingFile);

        // ── 3. Collect metadata, rename in temp, then move to final ────
        // Clean up orphan records left by any previous failed run for this record
        purgeOrphanTempRecords(ctx, stagedFile.getParent());

        trackingService.startFileSubStep(ctx.getJobId(), fileIndex, FileSubStep.MEDIA_INFO);
        MediaFileDto mediaInfo = mediaInfoService.collectAndPersist(
                stagedFile,
                ctx.getRecordId(),
                ctx.getJobId()
        );
        ctx.log("MEDIA_INFO", "Persisted: id=" + mediaInfo.getId()
                + ", tracks=" + (mediaInfo.getTracks() != null ? mediaInfo.getTracks().size() : 0));

        // Track the most-recently persisted DTO so we can roll back on failure
        MediaFileDto latestDto = mediaInfo;
        try {
            Path canonicalTempFile = renameCanonicalFile(ctx, stagedFile, mediaInfo);
            MediaFileDto canonicalDto = canonicalTempFile.equals(stagedFile)
                    ? mediaInfo
                    : recollectMediaInfo(ctx, stagedFile, canonicalTempFile);
            latestDto = canonicalDto;

            Path finalFile = moveToFinalLocation(ctx, canonicalTempFile);
            MediaFileDto finalDto = finalFile.equals(canonicalTempFile)
                    ? canonicalDto
                    : repersistAtFinalLocation(ctx, canonicalTempFile, finalFile);
            latestDto = finalDto;
            trackingService.updateFilePercent(ctx.getJobId(), fileIndex, FileSubStep.MEDIA_INFO, 100);

            symlinkService.create(finalDto.getId(), finalDto.getFilePath());

            // Scrub-preview storyboard (best-effort; never fails ingestion).
            try {
                ctx.log("STORYBOARD", "Generating scrub-preview storyboard…");
                trackingService.startFileSubStep(ctx.getJobId(), fileIndex, FileSubStep.STORYBOARD);
                storyboardService.generate(finalDto.getId(), finalFile, resolveDurationMs(finalDto),
                        (done, total) -> {
                            ctx.log("STORYBOARD", done + "/" + total + " tiles");
                            trackingService.updateFilePercent(ctx.getJobId(), fileIndex,
                                    FileSubStep.STORYBOARD, total > 0 ? done * 100.0 / total : 0);
                        });
            } catch (Exception e) {
                ctx.logError("STORYBOARD", "Generation failed (non-fatal): " + e.getMessage());
            }

            // Flag new season/episode so the record resurfaces on the home rail (TV only; best-effort).
            try {
                EpisodeRef ref = resolveEpisodeRef(ctx, finalFile);
                newContentTaggingService.evaluate(ctx.getRecordId(), finalDto.getId(),
                        ref != null ? ref.season() : null, ref != null ? ref.episode() : null);
            } catch (Exception e) {
                ctx.logError("NEW_CONTENT", "New-content flagging failed (non-fatal): " + e.getMessage());
            }

            log.info("[{}] FFmpeg processing complete — finalFile={}, mediaFileId={}",
                    ctx.getJobId(), finalFile.getFileName(), finalDto.getId());

            result.setFinalFile(finalFile);
            result.setSuccess(true);
            result.setMediaInfo(toMediaInfoMap(finalDto));
            return result;

        } catch (Exception e) {
            // Roll back the persisted media-file record so it doesn't appear as an orphan in the UI
            String orphanPath = latestDto.getFilePath();
            if (orphanPath != null) {
                log.error("[{}] FFmpeg processing failed — rolling back orphan media-file record: {}",
                        ctx.getJobId(), orphanPath, e);
                ctx.logError("FFMPEG", "Rolling back orphan media-file record: " + orphanPath);
                try {
                    mediaInfoService.deleteByFilePath(orphanPath);
                } catch (Exception rollbackEx) {
                    log.warn("[{}] Rollback of orphan record failed for {}: {}",
                            ctx.getJobId(), orphanPath, rollbackEx.getMessage(), rollbackEx);
                }
            } else {
                log.error("[{}] FFmpeg processing failed (no orphan to roll back)", ctx.getJobId(), e);
            }
            if (e instanceof IOException) throw (IOException) e;
            throw new IOException(e);
        }
    }

    private EpisodeRef detectFromFilename(Path file) {
        Matcher matcher = SEASON_EPISODE_PATTERN.matcher(file.getFileName().toString());
        if (!matcher.find()) return null;
        try {
            return new EpisodeRef(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    private Path enrichWithTmdb(IngestionContext ctx, Path movedFile) {
        try {
            EpisodeRef episodeRef = resolveEpisodeRef(ctx, movedFile);

            if (episodeRef != null && ctx.getRequest().getSeason() == null) {
                ctx.getRequest().setSeason(episodeRef.season());
                ctx.getRequest().setEpisode(episodeRef.episode());
            }

            // ── Resolve effective track filter ────────────────────────────────
            TrackFilter effectiveFilter = smartTrackFilterService.resolve(
                    movedFile, ctx.getRequest().getTrackFilter());
            // ─────────────────────────────────────────────────────────────────

            Path enriched = enrichmentService.enrich(
                    movedFile,
                    ctx.getRecordId(),
                    episodeRef != null ? episodeRef.season() : null,
                    episodeRef != null ? episodeRef.episode() : null,
                    effectiveFilter,
                    ctx.getJobId()
            );
            if (!enriched.equals(movedFile)) {
                ctx.log("FFMPEG", "Enriched → " + enriched.getFileName());
            } else {
                ctx.log("FFMPEG", "Final file → " + enriched.getFileName());
            }
            return enriched;
        } catch (Exception e) {
            ctx.logError("FFMPEG", "Enrichment failed (non-fatal): " + e.getMessage());
            return movedFile;
        }
    }

    private MediaFileDto recollectMediaInfo(IngestionContext ctx, Path previousFile, Path canonicalFile) {
        try {
            mediaInfoService.deleteByFilePath(previousFile.toAbsolutePath().toString());
            MediaFileDto dto = mediaInfoService.collectAndPersist(
                    canonicalFile,
                    ctx.getRecordId(),
                    ctx.getJobId()
            );
            ctx.log("MEDIA_INFO", "Re-persisted after rename: " + canonicalFile.getFileName());
            return dto;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private MediaFileDto repersistAtFinalLocation(IngestionContext ctx, Path previousFile, Path finalFile) {
        try {
            mediaInfoService.deleteByFilePath(previousFile.toAbsolutePath().toString());
            MediaFileDto dto = mediaInfoService.collectAndPersist(finalFile, ctx.getRecordId(), ctx.getJobId());
            ctx.log("MEDIA_INFO", "Persisted final output: " + finalFile.getFileName());
            return dto;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private Map<String, Object> toMediaInfoMap(MediaFileDto dto) {
        return Map.of(
                "mediaFileId", dto.getId(),
                "fileName", dto.getFileName() != null ? dto.getFileName() : ""
        );
    }

    /** Total runtime in ms from the general track, falling back to the primary video track. */
    private long resolveDurationMs(MediaFileDto dto) {
        if (dto == null) return 0L;
        TrackDto general = dto.getGeneralTrack();
        if (general != null && general.getDuration() != null) return general.getDuration();
        TrackDto video = dto.getPrimaryVideoTrack();
        if (video != null && video.getDuration() != null) return video.getDuration();
        return 0L;
    }

    // Deletes any media-file DB records pointing to the given temp directory that were
    // left behind by a previous failed job for the same record. Non-fatal: logs and continues.
    private void purgeOrphanTempRecords(IngestionContext ctx, Path tempDir) {
        try {
            String tempDirStr = tempDir.toAbsolutePath().toString();
            mediaInfoService.getByRecordId(ctx.getRecordId()).stream()
                    .filter(dto -> dto.getFilePath() != null && dto.getFilePath().startsWith(tempDirStr))
                    .forEach(dto -> {
                        ctx.log("FFMPEG", "Purging orphan media-file from previous run: " + dto.getFilePath());
                        try { mediaInfoService.deleteByFilePath(dto.getFilePath()); } catch (Exception e) {
                            ctx.logError("FFMPEG", "Could not purge orphan: " + e.getMessage());
                        }
                    });
        } catch (Exception e) {
            ctx.logError("FFMPEG", "Orphan purge failed (non-fatal): " + e.getMessage());
        }
    }

    private Path renameCanonicalFile(IngestionContext ctx, Path file, MediaFileDto mediaInfo) throws IOException {
        String desiredName = buildCanonicalFileName(ctx, file, mediaInfo);
        if (desiredName == null || desiredName.isBlank() || desiredName.equals(file.getFileName().toString())) {
            return file;
        }
        Path renamed = file.getParent().resolve(desiredName);
        try {
            Files.move(file, renamed, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IOException("Failed to rename " + file.getFileName() + " → " + renamed.getFileName() + ": " + e.getMessage(), e);
        }
        ctx.log("FFMPEG", "Canonical rename → " + renamed.getFileName());
        return renamed;
    }

    private String buildCanonicalFileName(IngestionContext ctx, Path file, MediaFileDto mediaInfo) {
        EpisodeRef episodeRef = resolveEpisodeRef(ctx, file);
        Optional<TmdbMediaEnrichmentService.MediaNamingInfo> namingInfo =
                enrichmentService.resolveNamingInfo(ctx.getRecordId(),
                        episodeRef != null ? episodeRef.season() : null,
                        episodeRef != null ? episodeRef.episode() : null,
                        ctx.getJobId());

        String ext = extension(file.getFileName().toString());
        TrackDto video = mediaInfo.getPrimaryVideoTrack();
        TrackDto audio = mediaInfo.getPrimaryAudioTrack();

        String resolution = MediaTagResolver.resolveResolution(video != null ? video.getWidth() : null, video != null ? video.getHeight() : null);
        String source = inferSource(file, ctx);
        String sourceType = inferSourceType(file);
        String videoCodec = normalizeVideoCodec(video != null ? video.getFormat() : null);
        String hdr = sanitizeHdr(video);
        String bitDepth = normalizeBitDepth(video);
        String language = buildAudioLanguageSegment(mediaInfo);
        String audioCodec = normalizeAudioCodec(audio != null ? audio.getFormat() : null);
        String channels = normalizeChannels(audio != null ? audio.getChannels() : null);

        StringBuilder name = new StringBuilder();
        if (episodeRef != null) {
            String seriesTitle = namingInfo.map(TmdbMediaEnrichmentService.MediaNamingInfo::seriesTitle)
                    .filter(t -> !t.isBlank())
                    .orElseGet(() -> inferSeriesTitle(file, namingInfo));
            name.append(sanitizeToken(seriesTitle))
                    .append(".S").append(String.format("%02d", episodeRef.season()))
                    .append("E").append(String.format("%02d", episodeRef.episode()));
            namingInfo.map(TmdbMediaEnrichmentService.MediaNamingInfo::episodeName)
                    .filter(t -> !t.isBlank()).ifPresent(episodeName -> name.append(".").append(sanitizeToken(episodeName)));
        } else {
            String title = namingInfo.map(TmdbMediaEnrichmentService.MediaNamingInfo::title)
                    .filter(t -> !t.isBlank())
                    .orElseGet(() -> stripExt(file.getFileName().toString()));
            name.append(sanitizeToken(title));
            namingInfo.map(TmdbMediaEnrichmentService.MediaNamingInfo::releaseYear)
                    .filter(y -> !y.isBlank())
                    .ifPresent(y -> name.append(".").append(y));
        }

        appendSegment(name, resolution);
        appendSegment(name, source);
        appendSegment(name, sourceType);
        appendSegment(name, videoCodec);
        appendSegment(name, hdr);
        appendSegment(name, bitDepth);
        appendSegment(name, language);
        appendSegment(name, audioCodec);
        appendSegment(name, channels);

        return name.append(".").append(ext.toLowerCase()).toString();
    }

    private Path stageForProcessing(IngestionContext ctx, Path sourceFile) throws IOException {
        Path tempDir = fileStorageService.resolveTempDir(ctx);
        Files.createDirectories(tempDir);

        if (sourceFile.toAbsolutePath().normalize().startsWith(tempDir.toAbsolutePath().normalize())) {
            return sourceFile;
        }

        Path staged = tempDir.resolve(sourceFile.getFileName().toString());
        ctx.log("FFMPEG", "Staging in temp: " + sourceFile.getFileName() + " → " + tempDir);
        try {
            Files.move(sourceFile, staged, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new IOException("Failed to stage " + sourceFile.getFileName() + " to temp: " + e.getMessage(), e);
        }
        return staged;
    }

    private Path moveToFinalLocation(IngestionContext ctx, Path file) throws IOException {
        Path finalDir = fileStorageService.resolveFinalDir(ctx);
        Files.createDirectories(finalDir);

        Path normalizedFile     = file.toAbsolutePath().normalize();
        Path normalizedFinalDir = finalDir.toAbsolutePath().normalize();
        if (normalizedFile.getParent() != null
                && normalizedFile.getParent().equals(normalizedFinalDir)) {
            return file; // already in final dir
        }

        Path finalPath = resolveNonConflicting(finalDir, file.getFileName().toString());
        if (!finalPath.getFileName().equals(file.getFileName())) {
            ctx.log("FFMPEG", "Duplicate detected — renaming to: " + finalPath.getFileName());
        }
        ctx.log("FFMPEG", "Promoting to final: " + file.getFileName() + " → " + finalDir);
        try {
            Files.move(file, finalPath);
        } catch (IOException e) {
            throw new IOException("Failed to move " + file.getFileName() + " to final location: " + e.getMessage(), e);
        }
        return finalPath;
    }

    /**
     * Returns a path in {@code targetDir} for the given {@code fileName} that does
     * not currently exist on disk.
     *
     * If {@code fileName} is free → returns it as-is.
     * Otherwise appends ".1", ".2", … until a free slot is found (up to 99).
     * Falls back to a timestamp suffix to guarantee uniqueness.
     */
    private Path resolveNonConflicting(Path targetDir, String fileName) {
        Path candidate = targetDir.resolve(fileName);
        if (!Files.exists(candidate)) return candidate;

        String base = stripExt(fileName);
        String ext  = extension(fileName);
        for (int suffix = 1; suffix < 100; suffix++) {
            candidate = targetDir.resolve(base + "." + suffix + "." + ext);
            if (!Files.exists(candidate)) return candidate;
        }
        // Fallback: timestamp suffix to guarantee uniqueness
        return targetDir.resolve(base + "." + System.currentTimeMillis() + "." + ext);
    }

    private void appendSegment(StringBuilder builder, String value) {
        if (value != null && !value.isBlank()) {
            builder.append(".").append(value);
        }
    }

    private String inferSource(Path file, IngestionContext ctx) {
        MediaSource detected = MediaTagResolver.detectSource(file.getFileName().toString());
        if (detected != MediaSource.UNKNOWN && !isGenericSource(detected)) {
            return sanitizeToken(detected.getLabel());
        }
        if (ctx.getSource() != null && "YOUTUBE".equalsIgnoreCase(ctx.getSource().getType())) {
            // Use the actual streaming platform detected from the URL (Hotstar, Netflix, etc.)
            Map<String, Object> attrs = ctx.getSource().getAttributes();
            if (attrs != null) {
                Object platform = attrs.get("platform");
                if (platform instanceof String s && !s.isBlank()) return sanitizeToken(s);
            }
            return "YOUTUBE";
        }
        return null;
    }

    private String inferSourceType(Path file) {
        MediaSource detected = MediaTagResolver.detectSource(file.getFileName().toString());
        if (detected != MediaSource.UNKNOWN && detected.getDefaultType() != null && !detected.getDefaultType().isBlank()) {
            return normalizeSourceType(detected.getDefaultType());
        }

        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.contains("remux")) return "REMUX";
        if (name.contains("web-dl") || name.contains("webdl")) return "WEB-DL";
        if (name.contains("webrip") || name.contains("web-rip")) return "WEBRip";
        if (name.contains("bluray") || name.contains("blu-ray")) return "BluRay";
        if (name.contains("bdrip")) return "BDRip";
        if (name.contains("hdtv")) return "HDTV";
        return "WEB-DL";
    }

    private String sanitizeHdr(TrackDto video) {
        if (video == null) return null;
        if (video.getHdrFormat() != null && !video.getHdrFormat().isBlank()) {
            return normalizeHdr(video.getHdrFormat());
        }
        if (video.getHdrFormatCompatibility() != null && !video.getHdrFormatCompatibility().isBlank()) {
            return normalizeHdr(video.getHdrFormatCompatibility());
        }
        return null;
    }

    private String sanitizeToken(String value) {
        if (value == null || value.isBlank()) return null;
        return PathSanitizer.sanitizePathComponent(value)
                .replace(' ', '.')
                .replaceAll("\\.+", ".");
    }

    private String normalizeVideoCodec(String format) {
        String resolved = MediaTagResolver.resolveVideoCodec(format);
        if (resolved != null) return sanitizeToken(resolved);
        if (format == null || format.isBlank()) return null;
        String upper = format.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("AVC") || upper.contains("H.264") || upper.contains("H264")) return "H264";
        if (upper.contains("HEVC") || upper.contains("H.265") || upper.contains("H265")) return "H265";
        if (upper.contains("XVID")) return "XviD";
        if (upper.contains("DIVX")) return "DivX";
        if (upper.contains("VP9")) return "VP9";
        if (upper.contains("AV1")) return "AV1";
        return sanitizeToken(format);
    }

    private String normalizeAudioCodec(String format) {
        String resolved = MediaTagResolver.resolveAudioCodec(format);
        if (resolved != null) return sanitizeToken(resolved.replace("EAC3", "DDP"));
        if (format == null || format.isBlank()) return null;
        String upper = format.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("AAC")) return "AAC";
        if (upper.contains("E-AC-3") || upper.contains("EAC3") || upper.contains("DDP")) return "DDP";
        if (upper.contains("AC-3") || upper.contains("AC3") || upper.contains("DD")) return "AC3";
        if (upper.contains("DTS-HD") || upper.contains("DTS HD")) return "DTS-HD";
        if (upper.contains("DTS")) return "DTS";
        if (upper.contains("TRUEHD")) return "TrueHD";
        if (upper.contains("FLAC")) return "FLAC";
        if (upper.contains("OPUS")) return "Opus";
        if (upper.contains("MP3") || upper.contains("MPEG AUDIO")) return "MP3";
        return sanitizeToken(format);
    }

    private String normalizeHdr(String hdrValue) {
        String resolved = MediaTagResolver.resolveHdr(hdrValue);
        if (resolved != null) {
            return sanitizeToken(resolved.replace("DV HDR", "DV.HDR").replace("HDR10+", "HDR10Plus"));
        }
        String upper = hdrValue.trim().toUpperCase(Locale.ROOT);
        if (upper.contains("DOLBY") || upper.contains("DV")) return "DV";
        if (upper.contains("HDR10+")) return "HDR10Plus";
        if (upper.contains("HDR10")) return "HDR10";
        if (upper.contains("HLG")) return "HLG";
        if (upper.contains("HDR")) return "HDR";
        return sanitizeToken(hdrValue);
    }

    private String normalizeBitDepth(TrackDto video) {
        if (video == null || video.getBitDepth() == null) return null;
        return MediaTagResolver.BIT_DEPTH_MAP.getOrDefault(video.getBitDepth(), video.getBitDepth() + "Bit");
    }

    /**
     * Builds the audio language filename segment including all unique language names.
     * Single track:    "{Lang}"                      e.g. "Hindi"
     * Two tracks:      "Dual.{Lang1}.{Lang2}"        e.g. "Dual.Hindi.English"
     * Two same lang:   "Dual.{Lang}"                 e.g. "Dual.Hindi"
     * Three+ tracks:   "Multi.{Lang1}.{Lang2}..."    e.g. "Multi.Hindi.English.Tamil"
     */
    private String buildAudioLanguageSegment(MediaFileDto mediaInfo) {
        if (mediaInfo.getTracks() == null) return null;

        List<TrackDto> audioTracks = mediaInfo.getTracks().stream()
                .filter(t -> "Audio".equals(t.getType()))
                .toList();

        if (audioTracks.isEmpty()) return null;

        TrackDto primary = mediaInfo.getPrimaryAudioTrack();
        String primaryLang = normalizeLanguage(primary != null ? primary.getLanguage() : null);

        // Collect unique language names in order: primary first, then remaining in track order
        List<String> langs = new ArrayList<>();
        if (primaryLang != null) langs.add(primaryLang);
        for (TrackDto t : audioTracks) {
            String lang = normalizeLanguage(t.getLanguage());
            if (lang != null && !langs.contains(lang)) langs.add(lang);
        }
        String langsJoined = String.join(".", langs);

        if (audioTracks.size() >= 3) return langsJoined.isBlank() ? "Multi" : "Multi." + langsJoined;
        if (audioTracks.size() == 2) return langsJoined.isBlank() ? "Dual"  : "Dual."  + langsJoined;
        return primaryLang;
    }

    private String normalizeLanguage(String language) {
        if (language == null || language.isBlank()) return null;
        String resolved = MediaTagResolver.resolveLanguage(language);
        if (resolved != null && !"Unknown".equalsIgnoreCase(resolved)) {
            return sanitizeToken(resolved);
        }
        return sanitizeToken(language.trim());
    }

    private String normalizeChannels(Integer channels) {
        if (channels == null || channels <= 0) return null;
        return switch (channels) {
            case 1 -> "1.0";
            case 2 -> "2.0";
            case 6 -> "5.1";
            case 8 -> "7.1";
            default -> channels + "Ch";
        };
    }

    private boolean isGenericSource(MediaSource source) {
        return switch (source) {
            case BLURAY, UHD_BLURAY, REMUX, DVD, WEB_DL, WEB_RIP, HDTV, CAM, TS, TELECINE, WORKPRINT, UNKNOWN -> true;
            default -> false;
        };
    }

    private String normalizeSourceType(String sourceType) {
        String upper = sourceType.trim().toUpperCase(Locale.ROOT);
        return switch (upper) {
            case "WEBRIP", "WEB-RIP" -> "WEBRip";
            case "WEB-DL", "WEBDL" -> "WEB-DL";
            case "BLURAY", "BLU-RAY" -> "BluRay";
            case "REMUX" -> "REMUX";
            case "DVD" -> "DVD";
            case "HDTV" -> "HDTV";
            case "CAM" -> "CAM";
            case "TS" -> "TS";
            case "TC" -> "TC";
            case "WORKPRINT" -> "WORKPRINT";
            default -> sanitizeToken(sourceType);
        };
    }

    private String inferSeriesTitle(Path file, Optional<TmdbMediaEnrichmentService.MediaNamingInfo> namingInfo) {
        String candidate = namingInfo.map(TmdbMediaEnrichmentService.MediaNamingInfo::title)
                .filter(t -> !t.isBlank())
                .orElseGet(() -> stripExt(file.getFileName().toString()));
        return candidate.replaceAll("(?i)[. _-]S\\d{2}E\\d{2}.*$", "").replace('.', ' ').trim();
    }

    private String buildAudioTrackTitle(TrackDto t) {
        String lang = normalizeLanguage(t.getLanguage());
        String codec = normalizeAudioCodec(t.getFormat());
        String channels = normalizeChannels(t.getChannels());
        String bitrate = formatBitrate(t.getBitRate());

        return Stream.of(lang, channels, codec, bitrate)
                .filter(v -> v != null && !v.isBlank())
                .collect(Collectors.joining(" "));
    }

    private String formatBitrate(Long bitrate) {
        if (bitrate == null || bitrate <= 0) return null;
        return (bitrate / 1000) + "kbps";
    }

    private EpisodeRef resolveEpisodeRef(IngestionContext ctx, Path file) {
        if (ctx.getRequest().getSeason() != null && ctx.getRequest().getEpisode() != null) {
            return new EpisodeRef(ctx.getRequest().getSeason(), ctx.getRequest().getEpisode());
        }
        Matcher matcher = SEASON_EPISODE_PATTERN.matcher(file.getFileName().toString());
        if (!matcher.find()) {
            return null;
        }
        try {
            return new EpisodeRef(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private record EpisodeRef(int season, int episode) {}

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(dot + 1) : "mkv";
    }

    private String stripExt(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
