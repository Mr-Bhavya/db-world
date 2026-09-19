package com.db.dbworld.app.live.service;

import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Locale;

/**
 * Reads playlist text from an http(s) URL or a local file.
 *
 * <p>Both paths refuse anything over {@link M3uParser#MAX_PLAYLIST_BYTES}, and the HTTP
 * path enforces it while streaming rather than trusting {@code Content-Length} — a server
 * that lies about the length, or omits it, would otherwise pull the whole body into memory
 * before the check could run.
 */
@Log4j2
@Component
public class PlaylistFetcher {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT    = Duration.ofSeconds(45);

    /** A plain default: some CDNs 403 a request with no User-Agent at all. */
    private static final String DEFAULT_UA = "Mozilla/5.0 (compatible; DbWorld/1.0; +https://db-world.in)";

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(CONNECT_TIMEOUT)
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    /** Thrown for anything that makes a source unusable; the message reaches the admin UI. */
    public static class FetchException extends RuntimeException {
        public FetchException(String message)                  { super(message); }
        public FetchException(String message, Throwable cause) { super(message, cause); }
    }

    /**
     * @param source http(s) URL or an absolute local path
     * @param userAgent optional override for the request's User-Agent
     * @return the playlist text
     * @throws FetchException on any transport, size or status failure
     */
    public String fetch(String source, String userAgent) {
        if (source == null || source.isBlank()) throw new FetchException("No playlist URL");
        var trimmed = source.strip();
        var lower   = trimmed.toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://")
                ? fetchHttp(trimmed, userAgent)
                : readFile(trimmed);
    }

    private String fetchHttp(String url, String userAgent) {
        try {
            var request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(READ_TIMEOUT)
                    .header("User-Agent", userAgent == null || userAgent.isBlank() ? DEFAULT_UA : userAgent)
                    .header("Accept", "*/*")
                    .GET()
                    .build();

            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            try (var body = response.body()) {
                if (response.statusCode() / 100 != 2) {
                    throw new FetchException("HTTP " + response.statusCode());
                }
                return readCapped(body);
            }
        } catch (FetchException e) {
            throw e;
        } catch (IOException e) {
            throw new FetchException("Could not reach the playlist: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new FetchException("Interrupted while fetching the playlist", e);
        } catch (IllegalArgumentException e) {
            throw new FetchException("Not a valid URL", e);
        }
    }

    private String readFile(String path) {
        try {
            var file = Path.of(path);
            if (!Files.isRegularFile(file)) throw new FetchException("No such file: " + path);
            if (Files.size(file) > M3uParser.MAX_PLAYLIST_BYTES) {
                throw new FetchException("Playlist is larger than " + mb() + " MB");
            }
            return Files.readString(file, StandardCharsets.UTF_8);
        } catch (FetchException e) {
            throw e;
        } catch (IOException e) {
            throw new FetchException("Could not read the file: " + e.getMessage(), e);
        }
    }

    /** Read at most {@link M3uParser#MAX_PLAYLIST_BYTES}, failing rather than truncating. */
    private String readCapped(InputStream in) throws IOException {
        var buffer = new byte[8192];
        var out    = new java.io.ByteArrayOutputStream(1 << 16);
        int read;
        while ((read = in.read(buffer)) != -1) {
            if (out.size() + read > M3uParser.MAX_PLAYLIST_BYTES) {
                // Truncating would hand the parser a half-read #EXTINF and silently import a
                // partial channel list, which looks like a working refresh. Fail loudly.
                throw new FetchException("Playlist is larger than " + mb() + " MB");
            }
            out.write(buffer, 0, read);
        }
        return out.toString(StandardCharsets.UTF_8);
    }

    private static int mb() { return M3uParser.MAX_PLAYLIST_BYTES / (1024 * 1024); }
}
