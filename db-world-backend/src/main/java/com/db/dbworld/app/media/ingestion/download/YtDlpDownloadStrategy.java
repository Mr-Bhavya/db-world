package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.core.processor.StreamProcessor;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Downloads YouTube/streaming-site content using yt-dlp.
 * Replaces the old UtilsServiceImpl.downloadYtFile() logic.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class YtDlpDownloadStrategy implements DownloadStrategy {

    private final ProcessExecutor          processExecutor;
    private final DbWorldRuntimeProperties runtimeProperties;
    private final FileStorageService       fileStorageService;
    private final TrackingService          trackingService;
    private final ObjectMapper             objectMapper;

    private final ConcurrentMap<String, AtomicBoolean> cancellationFlags = new ConcurrentHashMap<>();

    @Override
    public boolean supports(SourceMetadata metadata) {
        return "YOUTUBE".equals(metadata.getType());
    }

    @Override
    public DownloadResult download(IngestionContext ctx) {
        String jobId = ctx.getJobId();
        AtomicBoolean cancellation = new AtomicBoolean(false);
        cancellationFlags.put(jobId, cancellation);

        try {
            fileStorageService.prepareDirectories(ctx);

            Path tempDir = fileStorageService.resolveTempDir(ctx);
            String outputTemplate = tempDir.resolve(ctx.getJobId() + ".%(ext)s").toString();

            List<String> cmd = buildCommand(ctx, outputTemplate);
            ctx.log("YTDLP", "Running yt-dlp for: " + ctx.getRequest().getUri());

            AtomicReference<String> capturedFilename = new AtomicReference<>();
            AtomicLong downloadedBytes = new AtomicLong(0);
            AtomicLong totalBytes = new AtomicLong(0);

            IngestionProgressProcessor processor = new IngestionProgressProcessor(
                    ctx, capturedFilename, downloadedBytes, totalBytes, trackingService, objectMapper
            );

            String processOutput = processExecutor.runYtDlpCommand(cmd, processor, cancellation);

            // Parse filename from output (--print after_move:filename)
            String fileName = parseFilename(processOutput, capturedFilename.get(), ctx.getJobId());

            Path downloadedFile = resolveDownloadedFile(tempDir, ctx.getJobId(), fileName);

            if (downloadedFile == null || !Files.exists(downloadedFile)) {
                return DownloadResult.failure(jobId, "Downloaded file not found in temp dir: " + tempDir);
            }

            long size = Files.size(downloadedFile);
            ctx.log("YTDLP", "Download complete: " + downloadedFile.getFileName() + " (" + size + " bytes)");

            return DownloadResult.success(jobId, downloadedFile, downloadedFile.getFileName().toString(), size);

        } catch (Exception e) {
            log.error("[{}] yt-dlp download failed", jobId, e);
            ctx.logError("YTDLP", "Download failed: " + e.getMessage());
            return DownloadResult.failure(jobId, e.getMessage());
        } finally {
            cancellationFlags.remove(jobId);
        }
    }

    @Override
    public void cancel(String jobId) {
        AtomicBoolean flag = cancellationFlags.get(jobId);
        if (flag != null) {
            flag.set(true);
            log.info("[{}] yt-dlp cancellation requested", jobId);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Command builder — mirrors old UtilsServiceImpl.getYtCommand()
    // ─────────────────────────────────────────────────────────────────────────

    private List<String> buildCommand(IngestionContext ctx, String outputTemplate) {
        String uri = ctx.getRequest().getUri();
        String videoITag = ctx.getRequest().getVideoITag();
        String audioITag = ctx.getRequest().getAudioITag();
        boolean onlyAudio = ctx.getRequest().isOnlyAudio();

        List<String> cmd = new ArrayList<>();
        cmd.addAll(List.of("--progress-template", "%(progress)j"));

        if (requiresCookies(uri)) {
            cmd.addAll(List.of(
                    DbWorldConstants.YTDLP_COOKIES_CMD,
                    runtimeProperties.getHsCookies().toString()
            ));
        }

        cmd.addAll(List.of("-f", buildFormatSelector(videoITag, audioITag, onlyAudio)));
        cmd.addAll(List.of("-o", outputTemplate));
        cmd.addAll(List.of("--print", "after_move:filename"));
        cmd.add(uri);

        return cmd;
    }

    private String buildFormatSelector(String videoITag, String audioITag, boolean onlyAudio) {
        if (onlyAudio) return resolveAudio(audioITag);
        if (videoITag == null || videoITag.isBlank())
            return "bestvideo+" + resolveAudio(audioITag) + "/best";

        String video = "best".equals(videoITag) ? "bestvideo" : videoITag;
        if ("0".equals(audioITag)) return video;
        return video + "+" + resolveAudio(audioITag) + "/best";
    }

    private String resolveAudio(String audioITag) {
        return (audioITag == null || audioITag.isBlank() || "0".equals(audioITag))
                ? "bestaudio" : audioITag;
    }

    private boolean requiresCookies(String uri) {
        return uri != null && uri.toLowerCase().contains(DbWorldConstants.HOTSTAR_COM);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // File resolution helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String parseFilename(String processOutput, String capturedFilename, String jobId) {
        if (processOutput != null && !processOutput.isBlank()) {
            Optional<String> fromOutput = Arrays.stream(processOutput.split("\\R"))
                    .map(String::trim)
                    .filter(l -> !l.isEmpty() && !l.startsWith("{"))
                    .reduce((first, second) -> second);
            if (fromOutput.isPresent()) {
                return Path.of(fromOutput.get()).getFileName().toString();
            }
        }
        if (capturedFilename != null && !capturedFilename.isBlank()) {
            return Path.of(capturedFilename).getFileName().toString();
        }
        return jobId;
    }

    private Path resolveDownloadedFile(Path tempDir, String jobId, String fileName) {
        try {
            Path direct = tempDir.resolve(fileName);
            if (Files.exists(direct)) return direct;

            if (Files.isDirectory(tempDir)) {
                try (var stream = Files.list(tempDir)) {
                    return stream
                            .filter(p -> p.getFileName().toString().startsWith(jobId))
                            .findFirst()
                            .orElse(null);
                }
            }
        } catch (Exception e) {
            log.warn("[{}] Error resolving downloaded file: {}", jobId, e.getMessage());
        }
        return null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Stream processor — parses yt-dlp progress JSON and updates TrackingService
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Parses yt-dlp stdout line by line.
     *
     * Bug fix: the old implementation used fragile manual string-scanning for JSON parsing
     * (indexOf + substring arithmetic). This version uses Jackson for correctness and
     * robustness against formatting variations.
     */
    private static class IngestionProgressProcessor extends StreamProcessor {

        private final IngestionContext        ctx;
        private final AtomicReference<String> capturedFilename;
        private final AtomicLong              downloadedBytes;
        private final AtomicLong              totalBytes;
        private final TrackingService         trackingService;
        private final ObjectMapper            objectMapper;

        IngestionProgressProcessor(
                IngestionContext ctx,
                AtomicReference<String> capturedFilename,
                AtomicLong downloadedBytes,
                AtomicLong totalBytes,
                TrackingService trackingService,
                ObjectMapper objectMapper
        ) {
            super();
            this.ctx               = ctx;
            this.capturedFilename  = capturedFilename;
            this.downloadedBytes   = downloadedBytes;
            this.totalBytes        = totalBytes;
            this.trackingService   = trackingService;
            this.objectMapper      = objectMapper;
        }

        @Override
        protected void processLine(String line, boolean isErrorStream) {
            if (line == null || line.isBlank()) return;

            if (isErrorStream) {
                ctx.logError("YTDLP_STDERR", line);
                return;
            }

            // Lines from --print after_move:filename look like file paths
            if (!line.startsWith("{")
                    && (line.contains("/") || line.contains("\\") || line.contains("."))) {
                capturedFilename.set(line.trim());
                return;
            }

            // Progress JSON from --progress-template %(progress)j
            if (line.startsWith("{") && line.contains("downloaded_bytes")) {
                parseProgress(line);
            }
        }

        private void parseProgress(String json) {
            try {
                JsonNode node = objectMapper.readTree(json);

                Long   dl    = longOrNull(node, "downloaded_bytes");
                Long   tot   = longOrNull(node, "total_bytes");
                Double speed = doubleOrNull(node, "speed");
                Long   eta   = longOrNull(node, "eta");

                if (dl  != null) downloadedBytes.set(dl);
                if (tot != null) totalBytes.set(tot);

                long dlv  = downloadedBytes.get();
                long totv = totalBytes.get();
                if (totv > 0) {
                    trackingService.updateProgress(ctx.getJobId(),
                            new ProgressSnapshot(dlv, totv,
                                    speed != null ? speed : 0.0,
                                    eta   != null ? eta   : 0L));
                }
            } catch (Exception ignored) {
                // best-effort — malformed progress line is non-fatal
            }
        }

        private Long longOrNull(JsonNode node, String field) {
            JsonNode n = node.get(field);
            return (n == null || n.isNull()) ? null : n.asLong();
        }

        private Double doubleOrNull(JsonNode node, String field) {
            JsonNode n = node.get(field);
            return (n == null || n.isNull()) ? null : n.asDouble();
        }
    }
}
