package com.db.dbworld.app.filemanager.download;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DownloadServiceTest {

    static final long TTL_MS = 21_600_000L; // 6 hours

    FileLocationService locationService;
    DownloadService svc;
    Path base;

    @BeforeEach
    void setUp() throws Exception {
        locationService = mock(FileLocationService.class);
        base = Files.createTempDirectory("download-service");
        Files.writeString(base.resolve("hello.txt"), "hello world");
        when(locationService.resolveBase("l1")).thenReturn(base);
        svc = new DownloadService(locationService, TTL_MS);
    }

    @Test
    void issueTicket_thenStream_returnsFileBytes() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, false, resp);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(resp.getContentAsString()).isEqualTo("hello world");
    }

    @Test
    void download_setsAttachmentDispositionWithFilename() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, true, resp);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(resp.getContentAsString()).isEqualTo("hello world");
        assertThat(resp.getHeader("Content-Disposition"))
                .isNotNull()
                .contains("attachment")
                .contains("hello.txt");
    }

    @Test
    void issueTicket_supportsRangedStreaming() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, "bytes=0-4", false, resp);

        assertThat(resp.getStatus()).isEqualTo(206);
        assertThat(resp.getContentAsString()).isEqualTo("hello");
    }

    @Test
    void invalidTicket_sendsGone() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();

        svc.streamByTicket("does-not-exist", null, false, resp);

        assertThat(resp.getStatus()).isEqualTo(410);
    }

    @Test
    void ticketIsReusable_bothStreamsSucceed() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse first = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, false, first);
        assertThat(first.getStatus()).isEqualTo(200);
        assertThat(first.getContentAsString()).isEqualTo("hello world");

        MockHttpServletResponse second = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, false, second);
        assertThat(second.getStatus()).isEqualTo(200);
        assertThat(second.getContentAsString()).isEqualTo("hello world");
    }

    @Test
    void ticketExpiry_isStillEnforced() throws Exception {
        DownloadService shortLivedSvc = new DownloadService(locationService, 1L);
        String ticket = shortLivedSvc.issueTicket("l1", "/hello.txt");

        Thread.sleep(50);

        MockHttpServletResponse resp = new MockHttpServletResponse();
        shortLivedSvc.streamByTicket(ticket, null, false, resp);

        assertThat(resp.getStatus()).isEqualTo(410);
    }

    @Test
    void issueTicket_nonExistentPath_throwsDbWorldException() {
        assertThatThrownBy(() -> svc.issueTicket("l1", "/does-not-exist.txt"))
                .isInstanceOf(DbWorldException.class);
    }

    @Test
    void issueTicket_directoryPath_throwsDbWorldException() throws Exception {
        Files.createDirectory(base.resolve("subdir"));

        assertThatThrownBy(() -> svc.issueTicket("l1", "/subdir"))
                .isInstanceOf(DbWorldException.class);
    }
}
