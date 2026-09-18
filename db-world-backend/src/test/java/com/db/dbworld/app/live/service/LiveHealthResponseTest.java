package com.db.dbworld.app.live.service;

import org.junit.jupiter.api.Test;

import static com.db.dbworld.app.live.service.LiveHealthService.isPlayableResponse;
import static org.assertj.core.api.Assertions.assertThat;

/**
 * The health probe's verdict on a 2xx response.
 *
 * <p>Guards a bug that shipped: the first version accepted any 2xx with a body unless the
 * URL contained {@code .m3u8}. Curated playlists list {@code youtube.com/<channel>/live}
 * as the stream URL, which answers 200 with a megabyte of HTML — 22 of the 32 channels in
 * one Indian playlist would have been imported, marked UP, and played nothing.
 */
class LiveHealthResponseTest {

    private static final String MANIFEST = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n";

    @Test
    void an_hls_url_must_answer_with_a_manifest() {
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8", "application/vnd.apple.mpegurl", MANIFEST)).isTrue();
        // Servers send all sorts of content types for a manifest; the body is what counts.
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8", "application/octet-stream", MANIFEST)).isTrue();
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8", "text/plain", MANIFEST)).isTrue();
    }

    @Test
    void an_hls_url_answering_with_something_else_is_dead() {
        // The classic dead endpoint: 200, but an error page rather than a manifest.
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8", "text/plain", "Stream offline")).isFalse();
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8?token=x", "text/html", "<html>403</html>")).isFalse();
    }

    @Test
    void a_youtube_watch_page_is_not_a_stream() {
        // The exact shape that fooled the first version: not .m3u8, 200, plenty of bytes.
        assertThat(isPlayableResponse(
                "https://www.youtube.com/doordarshan/live",
                "text/html; charset=utf-8",
                "<!DOCTYPE html><html style=\"font-size: 62.5%\">")).isFalse();
    }

    @Test
    void html_under_a_lying_content_type_is_still_a_page() {
        assertThat(isPlayableResponse("https://portal.example/live", "application/octet-stream",
                "<!doctype html><title>Sign in</title>")).isFalse();
        assertThat(isPlayableResponse("https://portal.example/live", "",
                "<HTML><body>Not found</body></HTML>")).isFalse();
    }

    @Test
    void a_raw_transport_stream_passes() {
        // A bare MPEG-TS feed has no manifest to inspect, so bytes that are not a document
        // are the most that can be checked.
        assertThat(isPlayableResponse("https://cdn/live/stream.ts", "video/mp2t", "G@")).isTrue();
    }

    @Test
    void an_empty_body_is_dead_whatever_the_status_said() {
        assertThat(isPlayableResponse("https://cdn/live/index.m3u8", "application/vnd.apple.mpegurl", "")).isFalse();
        assertThat(isPlayableResponse("https://cdn/live/stream.ts", "video/mp2t", "   ")).isFalse();
        assertThat(isPlayableResponse("https://cdn/live/stream.ts", "video/mp2t", null)).isFalse();
    }
}
