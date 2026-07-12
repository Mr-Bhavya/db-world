package com.db.dbworld.app.filemanager.download;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DownloadServiceTest {

    FileLocationService locationService;
    DownloadService svc;
    Path base;

    @BeforeEach
    void setUp() throws Exception {
        locationService = mock(FileLocationService.class);
        base = Files.createTempDirectory("download-service");
        Files.writeString(base.resolve("hello.txt"), "hello world");
        when(locationService.resolveBase("l1")).thenReturn(base);
        svc = new DownloadService(locationService);
    }

    @Test
    void issueTicket_thenStream_returnsFileBytes() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, resp);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(resp.getContentAsString()).isEqualTo("hello world");
    }

    @Test
    void issueTicket_supportsRangedStreaming() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, "bytes=0-4", resp);

        assertThat(resp.getStatus()).isEqualTo(206);
        assertThat(resp.getContentAsString()).isEqualTo("hello");
    }

    @Test
    void invalidTicket_sendsGone() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();

        svc.streamByTicket("does-not-exist", null, resp);

        assertThat(resp.getStatus()).isEqualTo(410);
    }

    @Test
    void ticketIsOneTimeUse_secondAttemptIsGone() throws Exception {
        String ticket = svc.issueTicket("l1", "/hello.txt");
        svc.streamByTicket(ticket, null, new MockHttpServletResponse());

        MockHttpServletResponse resp = new MockHttpServletResponse();
        svc.streamByTicket(ticket, null, resp);

        assertThat(resp.getStatus()).isEqualTo(410);
    }
}
