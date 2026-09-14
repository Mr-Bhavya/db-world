package com.db.dbworld.app.appupdate.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.appupdate.model.AppVersionInfo;
import com.db.dbworld.app.appupdate.service.AppUpdateService;
import com.db.dbworld.app.appupdate.service.AppUpdateService.Availability;
import com.db.dbworld.app.appupdate.service.AppUpdateService.Lookup;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AppUpdateControllerTest {

    private static final String APK_URL =
            "https://github.com/Mr-Bhavya/db-world/releases/download/v3.0.29/db-world-3.0.29.apk";

    AppUpdateService service;
    AppUpdateController controller;

    @BeforeEach
    void setUp() {
        service = mock(AppUpdateService.class);
        controller = new AppUpdateController(service);
    }

    private static AppVersionInfo release() {
        return new AppVersionInfo(29822782L, "3.0.29", AppUpdateService.DOWNLOAD_PATH,
                true, 0L, "", 40184576L, "all");
    }

    private static String cacheControl(ResponseEntity<?> response) {
        return response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL);
    }

    // ── Serving a real release ───────────────────────────────────────────────

    @Test
    void download_redirectsToTheApk() {
        when(service.lookup()).thenReturn(new Lookup(release(), APK_URL, Availability.AVAILABLE));

        ResponseEntity<Void> response = controller.download();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).hasToString(APK_URL);
    }

    @Test
    void version_returnsTheRelease() {
        when(service.lookup()).thenReturn(new Lookup(release(), APK_URL, Availability.AVAILABLE));

        ResponseEntity<ApiResponse<AppVersionInfo>> response = controller.version();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getData().versionName()).isEqualTo("3.0.29");
    }

    // ── The bug: a cold cache must not read as "nothing published" ───────────

    /**
     * For a moment after every restart the GitHub lookup has not returned yet. Answering 404
     * there told the updater a live release did not exist, so it skipped it.
     */
    @Test
    void download_whileWarming_is503AndRetryable_not404() {
        when(service.lookup()).thenReturn(new Lookup(null, null, Availability.WARMING));

        ResponseEntity<Void> response = controller.download();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("5");
    }

    @Test
    void version_whileWarming_is503AndRetryable_not404() {
        when(service.lookup()).thenReturn(new Lookup(null, null, Availability.WARMING));

        ResponseEntity<ApiResponse<AppVersionInfo>> response = controller.version();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("5");
    }

    /** 404 survives, but only for the one case that actually means it. */
    @Test
    void download_whenNothingIsPublished_is404() {
        when(service.lookup()).thenReturn(new Lookup(null, null, Availability.EMPTY));

        assertThat(controller.download().getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void version_whenNothingIsPublished_is404() {
        when(service.lookup()).thenReturn(new Lookup(null, null, Availability.EMPTY));

        assertThat(controller.version().getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ── Nothing here may be cached ───────────────────────────────────────────

    /**
     * The original 404 carried no cache headers, so a browser was free to store it — which is
     * how a two-second startup window became a lasting failure on one phone.
     */
    @Test
    void everyResponseIsNoStore() {
        for (Availability availability : Availability.values()) {
            String apk = availability == Availability.AVAILABLE ? APK_URL : null;
            AppVersionInfo info = availability == Availability.AVAILABLE ? release() : null;
            when(service.lookup()).thenReturn(new Lookup(info, apk, availability));

            assertThat(cacheControl(controller.download()))
                    .as("download while %s", availability).contains("no-store");
            assertThat(cacheControl(controller.version()))
                    .as("version while %s", availability).contains("no-store");
        }
    }
}
