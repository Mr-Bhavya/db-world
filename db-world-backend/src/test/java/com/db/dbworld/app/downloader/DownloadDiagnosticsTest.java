package com.db.dbworld.app.downloader;

import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DownloadDiagnosticsTest {
    @Test void removesCredentialHeadersUrlsAndCookieOptions() {
        String safe = DownloadDiagnostics.safeText("ERROR HTTP 403 https://user:pass@example.com/watch?token=private\nAuthorization: Bearer abc123\nCookie: SID=secret\n--cookies '/private/cookies.txt'");
        for (String secret : List.of("user:pass", "token=private", "abc123", "SID=secret", "/private/cookies.txt")) assertFalse(safe.contains(secret), secret);
        assertTrue(safe.contains("HTTP 403"));
        assertFalse(safe.contains("\n"));
    }

    @Test void redactsStandaloneSecretsAndCookieFileRows() {
        String safe = DownloadDiagnostics.safeText("ERROR sessionid=abc password=xyz po_token='abc def' api_key=key SID=private");
        for (String secret : List.of("=abc", "=xyz", "abc def", "=key", "=private")) assertFalse(safe.contains(secret), secret);
        assertEquals("[cookie data redacted]", DownloadDiagnostics.safeText(".youtube.com\tTRUE\t/\tTRUE\t0\tSID\tprivate"));
    }

    @Test void boundsDiagnosticSizeAndUsesEffectiveOptionValues() {
        assertTrue(DownloadDiagnostics.safeText("x".repeat(5000)).length() < 2100);
        assertEquals("15", DownloadDiagnostics.option(List.of("yt-dlp", "--socket-timeout", "30", "--socket-timeout", "15"), "--socket-timeout"));
        assertTrue(DownloadDiagnostics.safeText("ERROR: Sign in to confirm you're not a bot").contains("not a bot"));
        assertFalse(DownloadDiagnostics.safeText("ERROR Bearer opaque-credential").contains("opaque-credential"));
        assertEquals("www.youtube.com", DownloadDiagnostics.sourceHost("https://www.youtube.com/watch?v=video&token=private"));
        assertEquals("invalid", DownloadDiagnostics.sourceHost("not a URL"));
    }
}