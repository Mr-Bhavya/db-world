package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;

/**
 * On-the-fly audio transcode for web clients that can't decode a file's audio
 * codec (E-AC3/AC3/DTS/TrueHD on Chrome/Firefox). Streams a fragmented MP4 with
 * the VIDEO COPIED (no re-encode) and audio re-encoded to AAC straight to the
 * HTTP response — nothing is stored. Cheap enough for a Raspberry Pi because the
 * video is never decoded/encoded.
 *
 * Seeking is handled by the client re-requesting with a `start` offset (ffmpeg
 * input-seeks to the nearest keyframe), so there's no HLS/session state here.
 * Concurrency is capped so a burst of viewers can't peg the box.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class StreamTranscodeService {

    /** Max simultaneous transcodes. Audio-only is light, but cap to protect the Pi. */
    private static final int  MAX_CONCURRENT      = 3;
    private static final long ACQUIRE_TIMEOUT_SEC = 8;
    private static final int  BUFFER_SIZE         = 64 * 1024;

    private final AppProperties  props;
    private final MediaInfoService mediaInfoService;
    private final Semaphore slots = new Semaphore(MAX_CONCURRENT);

    /**
     * @param audioIndex 0-based index AMONG AUDIO STREAMS (ffmpeg 0:a:n)
     * @param startSec   seek offset in seconds (input seek, keyframe-accurate)
     */
    public StreamingResponseBody transcode(String mediaFileId, int audioIndex, double startSec) {
        MediaFileDto mf = mediaInfoService.getById(mediaFileId)
                .orElseThrow(() -> new DbWorldException("MediaFile not found: " + mediaFileId));
        final Path file = Path.of(mf.getFilePath());
        if (!Files.exists(file)) {
            throw new DbWorldException("File not on disk: " + mf.getFilePath());
        }

        final int    audio = Math.max(0, audioIndex);
        final double start = Math.max(0, startSec);

        return outputStream -> {
            boolean acquired = false;
            Process proc = null;
            try {
                acquired = slots.tryAcquire(ACQUIRE_TIMEOUT_SEC, TimeUnit.SECONDS);
                if (!acquired) {
                    log.warn("Transcode capacity reached ({}), rejecting {}", MAX_CONCURRENT, mediaFileId);
                    return; // client gets an empty body -> playback fails; rare at personal scale
                }

                proc = new ProcessBuilder(buildCommand(file, audio, start))
                        .redirectErrorStream(false)
                        .start();

                // Drain stderr on a daemon thread so a full pipe can't block ffmpeg.
                final Process p = proc;
                Thread err = new Thread(() -> drainStderr(p, mediaFileId), "ffmpeg-err");
                err.setDaemon(true);
                err.start();

                byte[] buf = new byte[BUFFER_SIZE];
                int n;
                try (InputStream in = proc.getInputStream()) {
                    while ((n = in.read(buf)) != -1) {
                        outputStream.write(buf, 0, n);
                    }
                    outputStream.flush();
                }
            } catch (IOException e) {
                // Broken pipe = the browser closed the connection (paused/seeked/left). Normal.
                log.debug("Transcode stream closed for {}: {}", mediaFileId, e.getMessage());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                if (proc != null && proc.isAlive()) proc.destroyForcibly();
                if (acquired) slots.release();
            }
        };
    }

    private List<String> buildCommand(Path file, int audio, double start) {
        List<String> cmd = new ArrayList<>();
        cmd.add(props.getFfmpeg());
        cmd.add("-hide_banner");
        cmd.add("-loglevel"); cmd.add("error");
        if (start > 0) {                              // input seek (fast, keyframe)
            cmd.add("-ss"); cmd.add(String.format(Locale.US, "%.3f", start));
        }
        cmd.add("-i"); cmd.add(file.toString());
        cmd.add("-map"); cmd.add("0:v:0");            // first video stream
        cmd.add("-map"); cmd.add("0:a:" + audio);     // selected audio stream
        cmd.add("-c:v"); cmd.add("copy");             // never re-encode video
        cmd.add("-c:a"); cmd.add("aac");
        cmd.add("-b:a"); cmd.add("256k");
        // Fragmented MP4 so it can be streamed without a seekable output.
        cmd.add("-movflags"); cmd.add("frag_keyframe+empty_moov+default_base_moof");
        cmd.add("-f"); cmd.add("mp4");
        cmd.add("pipe:1");
        return cmd;
    }

    private void drainStderr(Process proc, String id) {
        try (BufferedReader r = new BufferedReader(
                new InputStreamReader(proc.getErrorStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                if (!line.isBlank()) log.warn("[ffmpeg {}] {}", id, line);
            }
        } catch (IOException ignored) { /* process ended */ }
    }
}
