package com.db.dbworld.app.downloader;

import java.net.InetAddress;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DownloadPolicyTest {
    @Test
    void blocksPrivateAndReservedDestinations() throws Exception {
        for (String address : new String[]{"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fc00::1"}) {
            assertFalse(DownloadPolicy.isPublic(InetAddress.getByName(address)), address);
        }
        assertTrue(DownloadPolicy.isPublic(InetAddress.getByName("8.8.8.8")));
    }

    @Test
    void rejectsUnsafeUrlsWithoutRunningAnExtractor() {
        for (String url : new String[]{"file:///etc/passwd", "http://127.0.0.1/admin", "http://user:pass@example.com", "--exec=command", "https://example.com:8080"}) {
            assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> DownloadPolicy.validateUrl(url));
        }
    }

    @Test
    void bestHasNoResolutionCapAndCustomAccepts8k() {
        assertEquals("bv*+ba/b", DownloadPolicy.formatArguments("best", null).get(1));
        assertTrue(DownloadPolicy.formatArguments("custom", "4320").get(1).contains("4320"));
        assertTrue(DownloadPolicy.formatArguments("custom", "540").get(1).contains("540"));
        assertEquals("bv+251", DownloadPolicy.formatArguments("best", null, null, "251", "auto").get(1));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> DownloadPolicy.formatArguments("custom", "1080;exec"));
        assertTrue(DownloadPolicy.formatArguments("mp3", null).contains("--audio-format"));
    }

    @Test
    void selectsExactTracksAndContainerWithoutFallbackToDifferentTracks() {
        var arguments = DownloadPolicy.formatArguments("best", null, "401", "251", "mkv");
        assertEquals("401+251", arguments.get(1));
        assertEquals("mkv", arguments.get(3));
        assertTrue(arguments.contains("--remux-video"));
        assertEquals("140", DownloadPolicy.formatArguments("m4a", null, null, "140", null).get(1));
    }

    @Test
    void rejectsExpressionsAndVideoTracksInMusicMode() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> DownloadPolicy.formatArguments("best", null, "401/--exec", null, null));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> DownloadPolicy.formatArguments("audio", null, "401", null, null));
        assertThrows(org.springframework.web.server.ResponseStatusException.class,
                () -> DownloadPolicy.formatArguments("best", null, null, null, "command"));
    }
}