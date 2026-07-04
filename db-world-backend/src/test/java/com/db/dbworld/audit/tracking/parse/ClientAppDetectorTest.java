package com.db.dbworld.audit.tracking.parse;

import com.db.dbworld.audit.tracking.enums.ClientApp;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ClientAppDetectorTest {

    @Test void detectsAria2() {
        assertThat(ClientAppDetector.detect("aria2/1.36.0")).isEqualTo(ClientApp.ARIA2);
    }
    @Test void detectsIdm() {
        assertThat(ClientAppDetector.detect("Internet Download Manager/6.41")).isEqualTo(ClientApp.IDM);
    }
    @Test void detects1dm() {
        assertThat(ClientAppDetector.detect("1DM/13.0 (Android)")).isEqualTo(ClientApp.ONEDM);
    }
    @Test void detectsVlc() {
        assertThat(ClientAppDetector.detect("VLC/3.0.18 LibVLC/3.0.18")).isEqualTo(ClientApp.VLC);
    }
    @Test void detectsWgetAndCurl() {
        assertThat(ClientAppDetector.detect("Wget/1.21.2")).isEqualTo(ClientApp.WGET);
        assertThat(ClientAppDetector.detect("curl/8.4.0")).isEqualTo(ClientApp.CURL);
    }
    @Test void detectsEdgeBeforeChrome() {
        // Edge UA also contains "Chrome" — Edge must win.
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 ... Chrome/120 Safari/537.36 Edg/120.0")).isEqualTo(ClientApp.EDGE);
    }
    @Test void detectsChrome() {
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 ... Chrome/120.0 Safari/537.36")).isEqualTo(ClientApp.CHROME);
    }
    @Test void detectsSafariNotChrome() {
        assertThat(ClientAppDetector.detect(
            "Mozilla/5.0 (Macintosh) AppleWebKit/605 Version/17.0 Safari/605.1.15"))
            .isEqualTo(ClientApp.SAFARI);
    }
    @Test void nullOrUnknown() {
        assertThat(ClientAppDetector.detect(null)).isEqualTo(ClientApp.UNKNOWN);
        assertThat(ClientAppDetector.detect("SomethingWeird/1.0")).isEqualTo(ClientApp.UNKNOWN);
    }
    @Test void channel_selfDeclaredApp_isApp() {
        assertThat(ClientAppDetector.channel(ClientApp.ARIA2, true)).isEqualTo(TrackChannel.APP);
    }
    @Test void channel_browser_isBrowser() {
        assertThat(ClientAppDetector.channel(ClientApp.CHROME, false)).isEqualTo(TrackChannel.BROWSER);
    }
    @Test void channel_downloadManager_isExternal() {
        assertThat(ClientAppDetector.channel(ClientApp.IDM, false)).isEqualTo(TrackChannel.EXTERNAL);
    }
}
