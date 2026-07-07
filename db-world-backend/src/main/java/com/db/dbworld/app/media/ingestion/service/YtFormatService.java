package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.YtFormat;
import com.db.dbworld.app.media.ingestion.model.YtFormatsResponse;
import com.db.dbworld.app.media.ingestion.model.YtPlaylistEntry;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

@Log4j2
@Service
@RequiredArgsConstructor
public class YtFormatService {

    private static final Duration FORMAT_TIMEOUT   = Duration.ofSeconds(120);
    private static final Duration PLAYLIST_TIMEOUT = Duration.ofSeconds(120);
    private static final int LOG_SNIPPET_LIMIT = 4_000;

    private final AppProperties runtimeProperties;
    private final ObjectMapper objectMapper;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Fetches available formats for a single video URL.
     * If the URL resolves to a playlist, returns playlist entries instead.
     */
    public YtFormatsResponse fetchFormats(String url) {
        final String normalizedUrl = validateUrl(url);
        log.debug("fetchFormats url={}", normalizedUrl);

        final ProbeContext ctx = resolveContext(normalizedUrl);
        final List<String> cmd = buildJsonCmd(ctx.ytDlp(), normalizedUrl, ctx.cookie(), false);

        log.info("yt-dlp formats command: {}", renderCommandForLog(cmd));

        final String stdout = runBlocking(cmd, FORMAT_TIMEOUT);
        final JsonNode root = parseJson(stdout, normalizedUrl);

        if ("playlist".equals(textOrNull(root, "_type"))) {
            log.info("fetchFormats: url {} resolved to playlist — returning entries", normalizedUrl);
            return parsePlaylist(root);
        }

        final YtFormatsResponse response = parseFormats(root);
        log.info(
                "fetchFormats: parsed formats for url={} title={} videoFormats={} audioFormats={}",
                normalizedUrl,
                response.getTitle(),
                response.getVideoFormats() != null ? response.getVideoFormats().size() : 0,
                response.getAudioFormats() != null ? response.getAudioFormats().size() : 0
        );
        return response;
    }

    /**
     * Fetches playlist/series entries without downloading video.
     */
    public YtFormatsResponse fetchPlaylist(String url) {
        final String normalizedUrl = validateUrl(url);
        log.debug("fetchPlaylist url={}", normalizedUrl);

        final ProbeContext ctx = resolveContext(normalizedUrl);
        final List<String> cmd = buildJsonCmd(ctx.ytDlp(), normalizedUrl, ctx.cookie(), true);

        log.info("yt-dlp playlist command: {}", renderCommandForLog(cmd));

        final String stdout = runBlocking(cmd, PLAYLIST_TIMEOUT);
        final JsonNode root = parseJson(stdout, normalizedUrl);

        final YtFormatsResponse response = parsePlaylist(root);
        log.info(
                "fetchPlaylist: parsed {} entries for url={} title={}",
                response.getPlaylistEntries() != null ? response.getPlaylistEntries().size() : 0,
                normalizedUrl,
                response.getTitle()
        );
        return response;
    }

    // ── Context / command building ────────────────────────────────────────────

    private ProbeContext resolveContext(String url) {
        final String ytDlp = ytDlpBin();
        final Path cookie = runtimeProperties.getCookieForUrl(url);

        logResolvedRuntime(url, ytDlp, cookie);
        return new ProbeContext(ytDlp, cookie);
    }

    private List<String> buildJsonCmd(String ytDlp, String url, Path cookie, boolean flatPlaylist) {
        final List<String> cmd = new ArrayList<>(8);
        cmd.add(ytDlp);
        cmd.add("-J");
        cmd.add(flatPlaylist ? "--flat-playlist" : "--no-playlist");
        cmd.add("--no-warnings");

        // Uncomment temporarily during investigation when you need yt-dlp verbose stderr
        // cmd.add("-v");

        if (cookie != null) {
            cmd.add("--cookies");
            cmd.add(cookie.toString());
        }

        cmd.add(url);
        return List.copyOf(cmd);
    }

    // ── Process execution ─────────────────────────────────────────────────────

    private String runBlocking(List<String> cmd, Duration timeout) {
        Objects.requireNonNull(cmd, "cmd must not be null");
        Objects.requireNonNull(timeout, "timeout must not be null");

        final Instant startedAt = Instant.now();
        final Process process = startProcess(cmd);

        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            final Future<String> stdoutFuture = executor.submit(() -> readAll(process.getInputStream()));
            final Future<String> stderrFuture = executor.submit(() -> readAll(process.getErrorStream()));

            final boolean finished;
            try {
                finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
                throw new YtProbeException("Interrupted while waiting for yt-dlp process", e);
            }

            if (!finished) {
                process.destroyForcibly();

                final String partialStdout = safeGet(stdoutFuture, Duration.ofSeconds(2));
                final String partialStderr = safeGet(stderrFuture, Duration.ofSeconds(2));

                log.error(
                        "yt-dlp probe timed out after {} ms. cmd={} stdoutPreview={} stderrPreview={}",
                        timeout.toMillis(),
                        renderCommandForLog(cmd),
                        shorten(partialStdout),
                        shorten(partialStderr)
                );

                throw new YtProbeException(
                        "yt-dlp timed out after " + timeout.toSeconds() + "s for: " + lastArg(cmd)
                );
            }

            final String stdout = safeGet(stdoutFuture, Duration.ofSeconds(5));
            final String stderr = safeGet(stderrFuture, Duration.ofSeconds(5));
            final int exitCode = process.exitValue();
            final long elapsedMs = Duration.between(startedAt, Instant.now()).toMillis();

            if (exitCode != 0) {
                log.error(
                        "yt-dlp probe failed. exitCode={} elapsedMs={} cmd={} stderr={} stdoutPreview={}",
                        exitCode,
                        elapsedMs,
                        renderCommandForLog(cmd),
                        shorten(stderr),
                        shorten(stdout)
                );

                throw new YtProbeException(buildProbeFailureMessage(exitCode, stderr));
            }

            if (stderr != null && !stderr.isBlank()) {
                log.warn(
                        "yt-dlp probe completed with stderr output. elapsedMs={} cmd={} stderr={}",
                        elapsedMs,
                        renderCommandForLog(cmd),
                        shorten(stderr)
                );
            } else {
                log.info(
                        "yt-dlp probe succeeded. elapsedMs={} cmd={}",
                        elapsedMs,
                        renderCommandForLog(cmd)
                );
            }

            return stdout;
        }
    }

    private Process startProcess(List<String> cmd) {
        final ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);

        try {
            return pb.start();
        } catch (IOException e) {
            log.error("Failed to start yt-dlp process. cmd={}", renderCommandForLog(cmd), e);
            throw new YtProbeException("Failed to start yt-dlp process: " + e.getMessage(), e);
        }
    }

    private String buildProbeFailureMessage(int exitCode, String stderr) {
        final StringBuilder sb = new StringBuilder(64)
                .append("yt-dlp exited with code ")
                .append(exitCode);

        if (stderr != null && !stderr.isBlank()) {
            sb.append(" | stderr: ").append(shorten(stderr));
        }

        return sb.toString();
    }

    // ── Parsers ───────────────────────────────────────────────────────────────

    private JsonNode parseJson(String stdout, String url) {
        try {
            return objectMapper.readTree(stdout);
        } catch (Exception e) {
            log.error("Failed to parse yt-dlp JSON output for url={} stdoutPreview={}", url, shorten(stdout), e);
            throw new YtProbeException("Failed to parse yt-dlp JSON output for url=" + url, e);
        }
    }

    private YtFormatsResponse parseFormats(JsonNode root) {
        final JsonNode formatsNode = root.get("formats");

        final int initialCapacity = formatsNode != null && formatsNode.isArray() ? formatsNode.size() : 8;
        final List<YtFormat> videoFormats = new ArrayList<>(initialCapacity);
        final List<YtFormat> audioFormats = new ArrayList<>(initialCapacity);

        if (formatsNode != null && formatsNode.isArray()) {
            for (JsonNode f : formatsNode) {
                final String vcodec = textOrNull(f, "vcodec");
                final String acodec = textOrNull(f, "acodec");

                final boolean hasVideo = vcodec != null && !"none".equals(vcodec);
                final boolean hasAudio = acodec != null && !"none".equals(acodec);

                if (!hasVideo && !hasAudio) {
                    continue;
                }

                final YtFormat format = YtFormat.builder()
                        .formatId(textOrNull(f, "format_id"))
                        .ext(textOrNull(f, "ext"))
                        .resolution(textOrNull(f, "resolution"))
                        .width(intOrNull(f, "width"))
                        .height(intOrNull(f, "height"))
                        .tbr(longOrNull(f, "tbr"))
                        .abr(longOrNull(f, "abr"))
                        .vbr(longOrNull(f, "vbr"))
                        .acodec(acodec)
                        .vcodec(vcodec)
                        .fps(textOrNull(f, "fps"))
                        .filesize(longOrNull(f, "filesize"))
                        .formatNote(textOrNull(f, "format_note"))
                        .dynamicRange(normaliseDynamicRange(textOrNull(f, "dynamic_range")))
                        .type(resolveFormatType(hasVideo, hasAudio))
                        .build();

                if (hasVideo) {
                    videoFormats.add(format);
                } else {
                    audioFormats.add(format);
                }
            }
        }

        return YtFormatsResponse.builder()
                .title(textOrNull(root, "title"))
                .thumbnail(textOrNull(root, "thumbnail"))
                .duration(longOrNull(root, "duration"))
                .uploader(textOrNull(root, "uploader"))
                .videoFormats(List.copyOf(videoFormats))
                .audioFormats(List.copyOf(audioFormats))
                .isPlaylist(false)
                .build();
    }

    private YtFormatsResponse parsePlaylist(JsonNode root) {
        final JsonNode entriesNode = root.get("entries");
        final int initialCapacity = entriesNode != null && entriesNode.isArray() ? entriesNode.size() : 8;

        final List<YtPlaylistEntry> entries = new ArrayList<>(initialCapacity);

        if (entriesNode != null && entriesNode.isArray()) {
            int index = 1;
            for (JsonNode e : entriesNode) {
                final String id = textOrNull(e, "id");
                String url = textOrNull(e, "url");
                if (url == null) {
                    url = textOrNull(e, "webpage_url");
                }

                if (id == null && url == null) {
                    continue;
                }

                entries.add(YtPlaylistEntry.builder()
                        .index(index++)
                        .id(id)
                        .title(textOrNull(e, "title"))
                        .url(url)
                        .thumbnail(textOrNull(e, "thumbnail"))
                        .duration(longOrNull(e, "duration"))
                        .uploader(textOrNull(e, "uploader"))
                        // Real series metadata when the source exposes it (e.g. Hotstar).
                        .seasonNumber(intOrNull(e, "season_number"))
                        .episodeNumber(intOrNull(e, "episode_number"))
                        .episode(textOrNull(e, "episode"))
                        .build());
            }
        }

        return YtFormatsResponse.builder()
                .title(textOrNull(root, "title"))
                .thumbnail(textOrNull(root, "thumbnail"))
                .uploader(textOrNull(root, "uploader"))
                .isPlaylist(true)
                .playlistEntries(List.copyOf(entries))
                .videoFormats(List.of())
                .audioFormats(List.of())
                .build();
    }

    // ── Logging helpers ───────────────────────────────────────────────────────

    private void logResolvedRuntime(String url, String ytDlp, Path cookie) {
        log.info("Resolved yt-dlp binary for url={}: {}", url, ytDlp);

        if (cookie == null) {
            log.info("No cookie file selected for url={}", url);
            return;
        }

        final boolean exists = Files.exists(cookie);
        final boolean readable = Files.isReadable(cookie);
        final boolean regularFile = Files.isRegularFile(cookie);

        log.info(
                "Selected cookie file for url={}: {} (exists={}, readable={}, regularFile={})",
                url,
                cookie,
                exists,
                readable,
                regularFile
        );
    }

    /**
     * Renders the command for logs; masks cookie file argument for safer logging.
     * Replace "***" with the real value if you explicitly want full raw path logging.
     */
    private String renderCommandForLog(List<String> cmd) {
        final List<String> copy = new ArrayList<>(cmd);

        for (int i = 0; i < copy.size() - 1; i++) {
            if ("--cookies".equals(copy.get(i))) {
                copy.set(i + 1, "***");
            }
        }

        return copy.stream()
                .map(this::quoteIfNeeded)
                .reduce((left, right) -> left + " " + right)
                .orElse("");
    }

    private String quoteIfNeeded(String value) {
        if (value == null) {
            return "null";
        }
        return value.contains(" ") ? "\"" + value + "\"" : value;
    }

    private String lastArg(List<String> cmd) {
        return (cmd == null || cmd.isEmpty()) ? "<unknown>" : cmd.getLast();
    }

    private String shorten(String value) {
        if (value == null) {
            return null;
        }
        return value.length() <= LOG_SNIPPET_LIMIT
                ? value
                : value.substring(0, LOG_SNIPPET_LIMIT) + "...[truncated]";
    }

    // ── IO helpers ────────────────────────────────────────────────────────────

    private String readAll(InputStream inputStream) throws IOException {
        try (BufferedReader reader =
                     new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            return reader.lines().reduce((left, right) -> left + "\n" + right).orElse("");
        }
    }

    private String safeGet(Future<String> future, Duration timeout) {
        try {
            return future.get(timeout.toMillis(), TimeUnit.MILLISECONDS);
        } catch (ExecutionException e) {
            final Throwable cause = e.getCause() != null ? e.getCause() : e;
            return "<unavailable: " + cause.getClass().getSimpleName() + ": " + cause.getMessage() + ">";
        } catch (Exception e) {
            return "<unavailable: " + e.getClass().getSimpleName() + ": " + e.getMessage() + ">";
        }
    }

    // ── Validation / mapping helpers ──────────────────────────────────────────

    private String validateUrl(String url) {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("url must not be blank");
        }
        return url.trim();
    }

    private String ytDlpBin() {
        final String bin = runtimeProperties.getYtDlp();
        if (bin == null || bin.isBlank()) {
            throw new IllegalStateException("yt-dlp binary path not configured (app.tools.yt-dlp)");
        }
        return bin;
    }

    private String resolveFormatType(boolean hasVideo, boolean hasAudio) {
        if (hasVideo && hasAudio) {
            return "combined";
        }
        return hasVideo ? "video" : "audio";
    }

    private String normaliseDynamicRange(String raw) {
        if (raw == null) {
            return null;
        }

        return switch (raw.toUpperCase()) {
            case "SDR" -> "SDR";
            case "HDR10" -> "HDR10";
            case "HDR10+" -> "HDR10+";
            case "HLG" -> "HLG";
            case "DOLBY VISION", "DV" -> "DV";
            default -> raw;
        };
    }

    private String textOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asString() : null;
    }

    private Integer intOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asInt() : null;
    }

    private Long longOrNull(JsonNode node, String field) {
        return node.has(field) && !node.get(field).isNull() ? node.get(field).asLong() : null;
    }

    // ── Internal types ────────────────────────────────────────────────────────

    private record ProbeContext(String ytDlp, Path cookie) {}

    public static final class YtProbeException extends RuntimeException {
        public YtProbeException(String message) {
            super(message);
        }

        public YtProbeException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}