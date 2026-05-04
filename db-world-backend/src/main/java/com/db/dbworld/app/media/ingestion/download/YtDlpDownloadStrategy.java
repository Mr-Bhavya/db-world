package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.core.processor.StreamProcessor;
import com.db.dbworld.config.AppProperties;
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

@Log4j2
@Component
@RequiredArgsConstructor
public class YtDlpDownloadStrategy implements DownloadStrategy {

    private final ProcessExecutor  processExecutor;
    private final AppProperties    runtimeProperties;
    private final FileStorageService fileStorageService;
    private final TrackingService  trackingService;
    private final ObjectMapper     objectMapper;

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
            AtomicLong totalBytes      = new AtomicLong(0);

            IngestionProgressProcessor processor = new IngestionProgressProcessor(
                    ctx, capturedFilename, downloadedBytes, totalBytes, trackingService, objectMapper
            );

            ctx.setCurrentStep(PipelineStepType.DOWNLOAD);
            String processOutput = processExecutor.runYtDlpCommand(cmd, processor, cancellation);

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

    // ── Command builder ───────────────────────────────────────────────────────

    private List<String> buildCommand(IngestionContext ctx, String outputTemplate) {
        String uri      = ctx.getRequest().getUri();
        String videoTag = ctx.getRequest().getVideoITag();
        String audioTag = ctx.getRequest().getAudioITag();
        boolean onlyAudio = ctx.getRequest().isOnlyAudio();

        List<String> cmd = new ArrayList<>();

        // Progress JSON on individual lines — without --newline, yt-dlp uses \r
        // and the line-based StreamProcessor never sees the JSON until ffmpeg starts.
        cmd.add("--progress");
        cmd.add("--newline");
        cmd.addAll(List.of("--progress-template", "%(progress)j"));

        // Per-platform cookie support
        Path cookie = runtimeProperties.getCookieForUrl(uri);
        if (cookie != null) {
            cmd.addAll(List.of("--cookies", cookie.toString()));
            ctx.log("YTDLP", "Using cookies: " + cookie.getFileName());
        }

        cmd.addAll(List.of("-f", buildFormatSelector(videoTag, audioTag, onlyAudio)));

        // Merge separate video+audio into mkv — best HDR/codec support
        if (!onlyAudio) {
            cmd.addAll(List.of("--merge-output-format", "mkv"));
        }

        // Retry fragments, no partial-file confusion
        cmd.addAll(List.of("--retries", "10"));
        cmd.addAll(List.of("--fragment-retries", "10"));
        cmd.addAll(List.of("--no-part"));

        cmd.addAll(List.of("-o", outputTemplate));
        cmd.addAll(List.of("--print", "after_move:filename"));
        cmd.add(uri);

        return cmd;
    }

    private String buildFormatSelector(String videoITag, String audioITag, boolean onlyAudio) {
        if (onlyAudio) return resolveAudio(audioITag);

        // No specific format requested — pick best available, prefer HDR when present
        if (videoITag == null || videoITag.isBlank()) {
            return "bestvideo[ext=mp4]+bestaudio[ext=m4a]"
                 + "/bestvideo+bestaudio"
                 + "/best";
        }

        // "best" sentinel → use yt-dlp's automatic best selection
        if ("best".equals(videoITag)) {
            return "bestvideo+" + resolveAudio(audioITag) + "/best";
        }

        // Specific format ID selected by user (e.g. from format picker)
        String video = videoITag;
        if ("0".equals(audioITag)) return video;           // video-only
        return video + "+" + resolveAudio(audioITag) + "/best";
    }

    private String resolveAudio(String audioITag) {
        return (audioITag == null || audioITag.isBlank() || "0".equals(audioITag))
                ? "bestaudio" : audioITag;
    }

    // ── File resolution helpers ───────────────────────────────────────────────

    private String parseFilename(String processOutput, String capturedFilename, String jobId) {
        if (processOutput != null && !processOutput.isBlank()) {
            Optional<String> fromOutput = Arrays.stream(processOutput.split("\\R"))
                    .map(String::trim)
                    .filter(l -> !l.isEmpty() && !l.startsWith("{"))
                    .reduce((first, second) -> second);
            if (fromOutput.isPresent()) return Path.of(fromOutput.get()).getFileName().toString();
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

    // ── Stream processor ──────────────────────────────────────────────────────

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
            this.ctx              = ctx;
            this.capturedFilename = capturedFilename;
            this.downloadedBytes  = downloadedBytes;
            this.totalBytes       = totalBytes;
            this.trackingService  = trackingService;
            this.objectMapper     = objectMapper;
        }

        @Override
        protected void processLine(String line, boolean isErrorStream) {
            if (line == null || line.isBlank()) return;

            // Progress JSON from --progress-template %(progress)j --newline
            if (line.startsWith("{") && line.contains("download")) {
                parseProgress(line);
                return;
            }

            // Lines from --print after_move:filename look like file paths
            if (!line.startsWith("{")
                    && (line.contains("/") || line.contains("\\") || line.contains("."))) {
                capturedFilename.set(line.trim());
                return;
            }

            if (isErrorStream) {
                // Detect ffmpeg merge stage from stderr
                if (line.contains("[ffmpeg]") || line.contains("[Merger]")) {
                    trackingService.updateProgress(ctx.getJobId(), ProgressSnapshot.merging());
                    ctx.log("YTDLP", line.trim());
                } else {
                    ctx.logError("YTDLP_STDERR", line);
                }
            }
        }

        private void parseProgress(String json) {
            try {
                JsonNode node = objectMapper.readTree(json);

                Long   dl    = longOrNull(node, "downloaded_bytes");
                Long   tot   = longOrNull(node, "total_bytes");
                if (tot == null) tot = longOrNull(node, "total_bytes_estimate");
                Double speed = doubleOrNull(node, "speed");
                Long   eta   = longOrNull(node, "eta");

                if (dl  != null) downloadedBytes.set(dl);
                if (tot != null) totalBytes.set(tot);

                long dlv  = downloadedBytes.get();
                long totv = totalBytes.get();
                if (totv > 0) {
                    trackingService.updateProgress(ctx.getJobId(),
                            ProgressSnapshot.downloading(dlv, totv,
                                    speed != null ? speed : 0.0,
                                    eta   != null ? eta   : 0L));
                }
            } catch (Exception ignored) {
                // best-effort — malformed progress line is non-fatal
            }
        }

        private Long   longOrNull(JsonNode n, String f)   { JsonNode v = n.get(f); return (v == null || v.isNull()) ? null : v.asLong(); }
        private Double doubleOrNull(JsonNode n, String f) { JsonNode v = n.get(f); return (v == null || v.isNull()) ? null : v.asDouble(); }
    }
}
