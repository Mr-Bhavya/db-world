package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.YtFormat;
import com.db.dbworld.app.media.ingestion.model.YtFormatsResponse;
import com.db.dbworld.app.media.ingestion.model.YtPlaylistEntry;
import com.db.dbworld.config.AppProperties;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class YtFormatService {

    private final AppProperties runtimeProperties;
    private final ObjectMapper  objectMapper;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Fetches available formats for a single video URL.
     * If the URL resolves to a playlist, returns the playlist entries instead
     * (videoFormats/audioFormats will be empty; caller should use playlistEntries).
     */
    public YtFormatsResponse fetchFormats(String url) throws Exception {
        log.debug("fetchFormats url={}", url);
        String ytDlp = ytDlpBin();
        Path cookie = runtimeProperties.getCookieForUrl(url);

        // Try as single video first (--no-playlist)
        List<String> cmd = buildJsonCmd(ytDlp, url, cookie, false);
        String stdout = runBlocking(cmd, 90);

        JsonNode root = objectMapper.readTree(stdout);

        // Playlist detected
        if ("playlist".equals(textOrNull(root, "_type"))) {
            log.info("fetchFormats: url {} resolved to playlist — returning entries", url);
            return parsePlaylist(root);
        }

        log.info("fetchFormats: parsed formats for url={}", url);
        return parseFormats(root);
    }

    /**
     * Fetches playlist/series entries without downloading any video.
     * Returns all entries so the frontend can show a selection list.
     */
    public YtFormatsResponse fetchPlaylist(String url) throws Exception {
        log.debug("fetchPlaylist url={}", url);
        String ytDlp = ytDlpBin();
        Path cookie = runtimeProperties.getCookieForUrl(url);

        List<String> cmd = buildJsonCmd(ytDlp, url, cookie, true);
        String stdout = runBlocking(cmd, 120);

        JsonNode root = objectMapper.readTree(stdout);
        YtFormatsResponse resp = parsePlaylist(root);
        log.info("fetchPlaylist: parsed {} entries for url={}",
                resp.getPlaylistEntries() != null ? resp.getPlaylistEntries().size() : 0, url);
        return resp;
    }

    // ── Command builder ───────────────────────────────────────────────────────

    private List<String> buildJsonCmd(String ytDlp, String url, Path cookie, boolean flatPlaylist) {
        List<String> cmd = new ArrayList<>();
        cmd.add(ytDlp);
        cmd.add("-J");
        if (flatPlaylist) {
            cmd.add("--flat-playlist");
        } else {
            cmd.add("--no-playlist");
        }
        cmd.add("--no-warnings");
        if (cookie != null) {
            cmd.add("--cookies");
            cmd.add(cookie.toString());
        }
        cmd.add(url);
        return cmd;
    }

    private String runBlocking(List<String> cmd, int timeoutSec) throws Exception {
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectErrorStream(false);
        Process proc = pb.start();

        String stdout;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
            stdout = reader.lines().collect(Collectors.joining("\n"));
        }

        boolean finished = proc.waitFor(timeoutSec, TimeUnit.SECONDS);
        if (!finished) {
            proc.destroyForcibly();
            log.error("yt-dlp probe timed out after {}s for: {}", timeoutSec, cmd.getLast());
            throw new RuntimeException("yt-dlp timed out after " + timeoutSec + "s for: " + cmd.getLast());
        }
        if (proc.exitValue() != 0) {
            // Capture stderr for better error messages
            log.error("yt-dlp probe exited with code {} for: {}", proc.exitValue(), cmd.getLast());
            throw new RuntimeException("yt-dlp exited with code " + proc.exitValue());
        }
        return stdout;
    }

    // ── Parsers ───────────────────────────────────────────────────────────────

    private YtFormatsResponse parseFormats(JsonNode root) {
        List<YtFormat> videoFormats = new ArrayList<>();
        List<YtFormat> audioFormats = new ArrayList<>();

        JsonNode formats = root.get("formats");
        if (formats != null && formats.isArray()) {
            for (JsonNode f : formats) {
                String vcodec = textOrNull(f, "vcodec");
                String acodec = textOrNull(f, "acodec");
                boolean hasVideo = vcodec != null && !"none".equals(vcodec);
                boolean hasAudio = acodec != null && !"none".equals(acodec);
                if (!hasVideo && !hasAudio) continue;

                YtFormat fmt = YtFormat.builder()
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
                        .type(hasVideo && hasAudio ? "combined" : hasVideo ? "video" : "audio")
                        .build();

                if (hasVideo) videoFormats.add(fmt);
                else          audioFormats.add(fmt);
            }
        }

        return YtFormatsResponse.builder()
                .title(textOrNull(root, "title"))
                .thumbnail(textOrNull(root, "thumbnail"))
                .duration(longOrNull(root, "duration"))
                .uploader(textOrNull(root, "uploader"))
                .videoFormats(videoFormats)
                .audioFormats(audioFormats)
                .isPlaylist(false)
                .build();
    }

    private YtFormatsResponse parsePlaylist(JsonNode root) {
        List<YtPlaylistEntry> entries = new ArrayList<>();
        JsonNode entriesNode = root.get("entries");
        if (entriesNode != null && entriesNode.isArray()) {
            int index = 1;
            for (JsonNode e : entriesNode) {
                String id  = textOrNull(e, "id");
                String url = textOrNull(e, "url");
                if (url == null) url = textOrNull(e, "webpage_url");
                if (id == null && url == null) continue;

                entries.add(YtPlaylistEntry.builder()
                        .index(index++)
                        .id(id)
                        .title(textOrNull(e, "title"))
                        .url(url)
                        .thumbnail(textOrNull(e, "thumbnail"))
                        .duration(longOrNull(e, "duration"))
                        .uploader(textOrNull(e, "uploader"))
                        .build());
            }
        }

        return YtFormatsResponse.builder()
                .title(textOrNull(root, "title"))
                .thumbnail(textOrNull(root, "thumbnail"))
                .uploader(textOrNull(root, "uploader"))
                .isPlaylist(true)
                .playlistEntries(entries)
                .videoFormats(List.of())
                .audioFormats(List.of())
                .build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String ytDlpBin() {
        String bin = runtimeProperties.getYtDlp();
        if (bin == null || bin.isBlank())
            throw new IllegalStateException("yt-dlp binary path not configured (app.tools.yt-dlp)");
        return bin;
    }

    /** Normalise yt-dlp dynamic_range values to clean display strings. */
    private String normaliseDynamicRange(String raw) {
        if (raw == null) return null;
        return switch (raw.toUpperCase()) {
            case "SDR"                  -> "SDR";
            case "HDR10"                -> "HDR10";
            case "HDR10+"               -> "HDR10+";
            case "HLG"                  -> "HLG";
            case "DOLBY VISION", "DV"   -> "DV";
            default                     -> raw;
        };
    }

    private String  textOrNull(JsonNode n, String f) {
        return n.has(f) && !n.get(f).isNull() ? n.get(f).asText() : null;
    }
    private Integer intOrNull(JsonNode n, String f) {
        return n.has(f) && !n.get(f).isNull() ? n.get(f).asInt() : null;
    }
    private Long    longOrNull(JsonNode n, String f) {
        return n.has(f) && !n.get(f).isNull() ? n.get(f).asLong() : null;
    }
}
