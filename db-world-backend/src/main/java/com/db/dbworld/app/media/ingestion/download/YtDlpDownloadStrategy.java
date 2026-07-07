package com.db.dbworld.app.media.ingestion.download;

import com.db.dbworld.app.media.ingestion.model.DownloadResult;
import com.db.dbworld.app.media.ingestion.model.IngestionContext;
import com.db.dbworld.app.media.ingestion.model.SourceMetadata;
import com.db.dbworld.app.media.ingestion.pipeline.PipelineStepType;
import com.db.dbworld.app.media.ingestion.processing.fs.FileStorageService;
import com.db.dbworld.app.media.ingestion.store.IngestionJobStore;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import com.db.dbworld.core.processor.StreamProcessor;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.processor.ProcessExecutor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
import java.util.concurrent.atomic.AtomicInteger;
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
    private final IngestionJobStore jobStore;

    private final ConcurrentMap<String, AtomicBoolean> cancellationFlags = new ConcurrentHashMap<>();

    @Override
    public boolean supports(SourceMetadata metadata) {
        return "YOUTUBE".equals(metadata.getType());
    }

    @Override
    public DownloadResult download(IngestionContext ctx) {
        String jobId = ctx.getJobId();
        log.debug("[{}] download uri={} videoITag={} audioITag={} onlyAudio={}",
                jobId, ctx.getRequest().getUri(),
                ctx.getRequest().getVideoITag(), ctx.getRequest().getAudioITag(),
                Boolean.TRUE.equals(ctx.getRequest().getOnlyAudio()));
        AtomicBoolean cancellation = new AtomicBoolean(false);
        cancellationFlags.put(jobId, cancellation);
        // Register the cancel action so the controller's executeCancelAction actually flips this
        // flag — ProcessExecutor polls it (every 300ms) and force-terminates yt-dlp. Without this
        // a cancelled yt-dlp job kept running in the background and updating progress.
        jobStore.setCancelAction(jobId, () -> cancellation.set(true));

        try {
            fileStorageService.prepareDirectories(ctx);
            Path tempDir = fileStorageService.resolveTempDir(ctx);
            // Name by the video title (+ id for uniqueness) so an UNASSIGNED download keeps a real
            // name instead of the job UUID. Assigned jobs are renamed again from TMDB in processing.
            // Byte-limited (.120B) so the name stays under the 255-byte filesystem limit with the id/ext.
            String outputTemplate = tempDir.resolve("%(title).120B [%(id)s].%(ext)s").toString();

            List<String> cmd = buildCommand(ctx, outputTemplate);
            String formatSelector = buildFormatSelector(
                    ctx.getRequest().getVideoITag(),
                    ctx.getRequest().getAudioITag(),
                    Boolean.TRUE.equals(ctx.getRequest().getOnlyAudio()),
                    ctx.getRequest().getVideoQuality());
            log.info("[{}] yt-dlp starting — uri={}, format={}, tempDir={}",
                    jobId, ctx.getRequest().getUri(), formatSelector, tempDir);
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
                log.error("[{}] yt-dlp completed but file missing in {} (expected name={})",
                        jobId, tempDir, fileName);
                return DownloadResult.failure(jobId, "Downloaded file not found in temp dir: " + tempDir);
            }

            long size = Files.size(downloadedFile);
            log.info("[{}] yt-dlp completed — file={}, size={} bytes",
                    jobId, downloadedFile.getFileName(), size);
            ctx.log("YTDLP", "Download complete: " + downloadedFile.getFileName() + " (" + size + " bytes)");
            return DownloadResult.success(jobId, downloadedFile, downloadedFile.getFileName().toString(), size);

        } catch (Exception e) {
            log.error("[{}] yt-dlp download failed (exit/error): {}", jobId, e.getMessage(), e);
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
        boolean onlyAudio = Boolean.TRUE.equals(ctx.getRequest().getOnlyAudio());

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

        cmd.addAll(List.of("-f", buildFormatSelector(videoTag, audioTag, onlyAudio,
                ctx.getRequest().getVideoQuality())));

        // Merge separate video+audio into mkv — best HDR/codec support
        if (!onlyAudio) {
            cmd.addAll(List.of("--merge-output-format", "mkv"));
        }

        // Retry fragments, no partial-file confusion
        cmd.addAll(List.of("--retries", "10"));
        cmd.addAll(List.of("--fragment-retries", "10"));
        cmd.addAll(List.of("--no-part"));

        // Each ingestion job is a single item (playlists are expanded to per-item jobs upstream),
        // so never let a watch?v=…&list=… URL expand into its whole playlist.
        cmd.add("--no-playlist");

        cmd.addAll(List.of("-o", outputTemplate));
        cmd.addAll(List.of("--print", "after_move:filename"));
        cmd.add(uri);

        return cmd;
    }

    private String buildFormatSelector(String videoITag, String audioITag, boolean onlyAudio, String videoQuality) {
        if (onlyAudio) return resolveAudio(audioITag);

        // A specific itag (from the single-video format picker) takes precedence. Otherwise fall
        // back to a height-based quality preset — the only thing that works across a playlist,
        // where itags differ per video.
        if (videoITag == null || videoITag.isBlank() || "best".equals(videoITag)) {
            return qualitySelector(videoQuality, audioITag);
        }

        // Specific format ID selected by user (e.g. from format picker)
        if ("0".equals(audioITag)) return videoITag;       // video-only
        return videoITag + "+" + resolveAudio(audioITag) + "/best";
    }

    /**
     * Height-based selector applied uniformly — resolves to the best matching format per video,
     * so it works for every item of a playlist regardless of that item's specific itags.
     * {@code videoQuality} is "best"/blank or a numeric height cap ("2160", "1080", "720", "480").
     */
    private String qualitySelector(String videoQuality, String audioITag) {
        String audio = resolveAudio(audioITag);
        if (videoQuality == null || videoQuality.isBlank() || "best".equalsIgnoreCase(videoQuality)) {
            return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+" + audio + "/best";
        }
        try {
            int h = Integer.parseInt(videoQuality.trim());
            return "bestvideo[height<=" + h + "]+" + audio + "/best[height<=" + h + "]/best";
        } catch (NumberFormatException e) {
            return "bestvideo+" + audio + "/best";
        }
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
            // Primary: the exact final path yt-dlp printed via --print after_move:filename.
            if (fileName != null && !fileName.isBlank()) {
                Path direct = tempDir.resolve(fileName);
                if (Files.exists(direct)) return direct;
            }
            // Fallback (title template means we can't match on jobId): the most recently modified
            // regular file in the temp dir — the one this job just finished downloading.
            if (Files.isDirectory(tempDir)) {
                try (var stream = Files.list(tempDir)) {
                    return stream
                            .filter(Files::isRegularFile)
                            .max(java.util.Comparator.comparingLong(p -> p.toFile().lastModified()))
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

        // Cumulative bytes from completed streams (video done, audio starting)
        private final AtomicLong    committedBytes = new AtomicLong(0);
        private final AtomicInteger streamCount    = new AtomicInteger(1);

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
            if (line.startsWith("{") && line.contains("\"status\"")) {
                parseProgress(line);
                return;
            }

            // Post-download merge / fixup stage. yt-dlp prints these to stdout OR stderr and they
            // contain slashes + dots, so they MUST be matched before the filename heuristic below —
            // otherwise "[Merger] Merging formats into …" was swallowed as a filename and the bar
            // stayed pinned at the last 100% download snapshot instead of switching to "Merging…".
            if (line.contains("[Merger]") || line.contains("[ffmpeg]")
                    || line.contains("[Fixup") || line.contains("Merging formats")) {
                trackingService.updateProgress(ctx.getJobId(), ProgressSnapshot.merging());
                ctx.log("YTDLP", line.trim());
                return;
            }

            // Lines from --print after_move:filename look like file paths
            if (!line.startsWith("{")
                    && (line.contains("/") || line.contains("\\") || line.contains("."))) {
                capturedFilename.set(line.trim());
                return;
            }

            if (isErrorStream) {
                ctx.logError("YTDLP_STDERR", line);
            }
        }

        private void parseProgress(String json) {
            try {
                JsonNode node = objectMapper.readTree(json);

                String status = node.has("status") ? node.get("status").asText("") : "";

                Long   dl    = longOrNull(node, "downloaded_bytes");
                Long   tot   = longOrNull(node, "total_bytes");
                if (tot == null) tot = longOrNull(node, "total_bytes_estimate");
                Double speed = doubleOrNull(node, "speed");
                Long   eta   = longOrNull(node, "eta");

                // Detect when a new stream starts: dl resets to near-zero while we had
                // already downloaded substantial data (video done, audio starting).
                if ("downloading".equals(status)
                        && dl != null && downloadedBytes.get() > 1_000_000L
                        && dl < downloadedBytes.get() / 2) {
                    long prevBytes = totalBytes.get() > 0 ? totalBytes.get() : downloadedBytes.get();
                    committedBytes.addAndGet(prevBytes);
                    int nextStream = streamCount.incrementAndGet();
                    ctx.log("YTDLP", "Stream " + (nextStream - 1) + " complete ("
                            + formatBytes(prevBytes) + "), downloading stream " + nextStream + "…");
                }

                if (dl  != null) downloadedBytes.set(dl);
                if (tot != null) totalBytes.set(tot);

                long dlv  = committedBytes.get() + downloadedBytes.get();
                long totv = committedBytes.get() + totalBytes.get();

                // Update progress bar even when total is unknown (totv=0 means unknown total)
                if (dlv > 0 && "downloading".equals(status)) {
                    trackingService.updateProgress(ctx.getJobId(),
                            ProgressSnapshot.downloading(dlv, totv,
                                    speed != null ? speed : 0.0,
                                    eta   != null ? eta   : 0L));
                }

                if ("finished".equals(status) && dl != null) {
                    ctx.log("YTDLP", "Downloaded " + formatBytes(committedBytes.get() + dl));
                }
            } catch (Exception ignored) {
                // best-effort — malformed progress line is non-fatal
            }
        }

        private static String formatBytes(long bytes) {
            if (bytes >= 1_000_000_000L) return String.format("%.1f GB", bytes / 1.0e9);
            if (bytes >= 1_000_000L)     return String.format("%.1f MB", bytes / 1.0e6);
            return String.format("%.0f KB", bytes / 1.0e3);
        }

        private Long   longOrNull(JsonNode n, String f)   { JsonNode v = n.get(f); return (v == null || v.isNull()) ? null : v.asLong(); }
        private Double doubleOrNull(JsonNode n, String f) { JsonNode v = n.get(f); return (v == null || v.isNull()) ? null : v.asDouble(); }
    }
}
