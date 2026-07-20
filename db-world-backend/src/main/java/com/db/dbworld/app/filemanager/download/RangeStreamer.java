package com.db.dbworld.app.filemanager.download;

import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** Streams a file to an {@link HttpServletResponse}, honoring HTTP Range requests (RFC 7233). */
public final class RangeStreamer {

    private static final int BUFFER_SIZE = 8192;

    private RangeStreamer() {}

    /**
     * Streams {@code file} to {@code resp}. If {@code rangeHeader} parses as a valid
     * {@code bytes=start-end} range, writes a 206 partial response with {@code Content-Range};
     * otherwise writes the full file with a 200 response. Uses an 8 KB buffer.
     */
    public static void stream(Path file, String rangeHeader, HttpServletResponse resp, boolean asAttachment) throws IOException {
        long total = Files.size(file);
        String ext = extensionOf(file);
        String contentType = asAttachment ? "application/octet-stream" : FileMetadataMapper.guessMime(ext);
        resp.setContentType(contentType);
        resp.setHeader("Accept-Ranges", "bytes");
        if (asAttachment) {
            String filename = URLEncoder.encode(file.getFileName().toString(), StandardCharsets.UTF_8)
                    .replace("+", "%20");
            resp.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + filename);
        }

        long start = 0;
        long end = total == 0 ? 0 : total - 1;
        boolean partial = false;

        if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
            String spec = rangeHeader.substring("bytes=".length());
            // A blank spec (e.g. bare "bytes=") or one with no "-" isn't a usable range —
            // fall back to a full 200 response rather than misreading it as a suffix range.
            if (!spec.isBlank() && spec.contains("-")) {
                String[] parts = spec.split("-", 2);
                try {
                    long rangeStart = parts[0].isBlank() ? -1 : Long.parseLong(parts[0].trim());
                    long rangeEnd = (parts.length > 1 && !parts[1].isBlank()) ? Long.parseLong(parts[1].trim()) : total - 1;

                    if (rangeStart < 0) {
                        // Suffix range "bytes=-N" — last N bytes.
                        long suffixLength = rangeEnd;
                        rangeStart = Math.max(0, total - suffixLength);
                        rangeEnd = total - 1;
                    }
                    if (rangeEnd >= total) rangeEnd = total - 1;

                    if (rangeStart <= rangeEnd && rangeStart < total) {
                        start = rangeStart;
                        end = rangeEnd;
                        partial = true;
                    } else {
                        resp.setStatus(HttpServletResponse.SC_REQUESTED_RANGE_NOT_SATISFIABLE);
                        resp.setHeader("Content-Range", "bytes */" + total);
                        return;
                    }
                } catch (NumberFormatException ignored) {
                    // Malformed range header — fall back to a full 200 response.
                    partial = false;
                    start = 0;
                    end = total == 0 ? 0 : total - 1;
                }
            }
        }

        long length = total == 0 ? 0 : (end - start + 1);
        if (partial) {
            resp.setStatus(HttpServletResponse.SC_PARTIAL_CONTENT);
            resp.setHeader("Content-Range", "bytes " + start + "-" + end + "/" + total);
        } else {
            resp.setStatus(HttpServletResponse.SC_OK);
        }
        resp.setContentLengthLong(length);

        try (InputStream in = Files.newInputStream(file);
             OutputStream out = resp.getOutputStream()) {
            long skipped = in.skip(start);
            long toSkip = start - skipped;
            while (toSkip > 0) {
                long more = in.skip(toSkip);
                if (more <= 0) break;
                toSkip -= more;
            }
            byte[] buffer = new byte[BUFFER_SIZE];
            long remaining = length;
            int read;
            while (remaining > 0 && (read = in.read(buffer, 0, (int) Math.min(BUFFER_SIZE, remaining))) != -1) {
                out.write(buffer, 0, read);
                remaining -= read;
            }
        }
    }

    private static String extensionOf(Path p) {
        String name = p.getFileName() != null ? p.getFileName().toString() : "";
        return name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
    }
}
