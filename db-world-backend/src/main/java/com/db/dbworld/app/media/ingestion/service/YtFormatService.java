package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.YtFormat;
import com.db.dbworld.app.media.ingestion.model.YtFormatsResponse;
import com.db.dbworld.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * Fetches available video/audio formats from a YouTube or streaming URL using yt-dlp -J.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class YtFormatService {

    private final AppProperties runtimeProperties;
    private final ObjectMapper             objectMapper;

    /**
     * Run {@code yt-dlp -J --no-playlist <url>} and parse the returned JSON
     * into separate video and audio format lists.
     */
    public YtFormatsResponse fetchFormats(String url) throws Exception {
        String ytDlp = runtimeProperties.getYtDlp();
        if (ytDlp == null || ytDlp.isBlank()) {
            throw new IllegalStateException("yt-dlp binary path not configured (app.tools.yt-dlp)");
        }

        ProcessBuilder pb = new ProcessBuilder(ytDlp, "-J", "--no-playlist", "--quiet", url);
        pb.redirectErrorStream(false);
        Process proc = pb.start();

        String stdout;
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(proc.getInputStream()))) {
            stdout = reader.lines().collect(Collectors.joining("\n"));
        }

        boolean finished = proc.waitFor(60, TimeUnit.SECONDS);
        if (!finished) {
            proc.destroyForcibly();
            throw new RuntimeException("yt-dlp timed out fetching formats for: " + url);
        }
        if (proc.exitValue() != 0) {
            throw new RuntimeException("yt-dlp exited with code " + proc.exitValue() + " for: " + url);
        }

        return parseFormats(stdout);
    }

    private YtFormatsResponse parseFormats(String json) throws Exception {
        JsonNode root = objectMapper.readTree(json);

        String title     = textOrNull(root, "title");
        String thumbnail = textOrNull(root, "thumbnail");
        Long   duration  = root.has("duration") && !root.get("duration").isNull()
                           ? root.get("duration").asLong() : null;
        String uploader  = textOrNull(root, "uploader");

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
                        .type(hasVideo && hasAudio ? "combined" : hasVideo ? "video" : "audio")
                        .build();

                if (hasVideo) videoFormats.add(fmt);
                else          audioFormats.add(fmt);
            }
        }

        return YtFormatsResponse.builder()
                .title(title)
                .thumbnail(thumbnail)
                .duration(duration)
                .uploader(uploader)
                .videoFormats(videoFormats)
                .audioFormats(audioFormats)
                .build();
    }

    private String  textOrNull(JsonNode n, String field) {
        return n.has(field) && !n.get(field).isNull() ? n.get(field).asText() : null;
    }
    private Integer intOrNull(JsonNode n, String field) {
        return n.has(field) && !n.get(field).isNull() ? n.get(field).asInt() : null;
    }
    private Long    longOrNull(JsonNode n, String field) {
        return n.has(field) && !n.get(field).isNull() ? n.get(field).asLong() : null;
    }
}
