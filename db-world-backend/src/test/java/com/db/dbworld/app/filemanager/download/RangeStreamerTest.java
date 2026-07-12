package com.db.dbworld.app.filemanager.download;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class RangeStreamerTest {

    Path file;

    @BeforeEach
    void setUp() throws Exception {
        file = Files.createTempFile("range-streamer", ".bin");
        byte[] data = new byte[100];
        for (int i = 0; i < data.length; i++) data[i] = (byte) i;
        Files.write(file, data);
    }

    @Test
    void partialRange_returns206WithSlice() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();

        RangeStreamer.stream(file, "bytes=0-9", resp, false);

        assertThat(resp.getStatus()).isEqualTo(206);
        assertThat(resp.getHeader("Content-Range")).isEqualTo("bytes 0-9/100");
        assertThat(resp.getHeader("Accept-Ranges")).isEqualTo("bytes");
        assertThat(resp.getContentAsByteArray()).hasSize(10);
    }

    @Test
    void nullRange_returnsFullBody() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();

        RangeStreamer.stream(file, null, resp, false);

        assertThat(resp.getStatus()).isEqualTo(200);
        assertThat(resp.getContentAsByteArray()).hasSize(100);
    }

    @Test
    void asAttachment_setsContentDispositionWithEncodedFilename() throws Exception {
        MockHttpServletResponse resp = new MockHttpServletResponse();

        RangeStreamer.stream(file, null, resp, true);

        assertThat(resp.getHeader("Content-Disposition"))
                .startsWith("attachment; filename*=UTF-8''");
        assertThat(resp.getContentType()).isEqualTo("application/octet-stream");
    }
}
