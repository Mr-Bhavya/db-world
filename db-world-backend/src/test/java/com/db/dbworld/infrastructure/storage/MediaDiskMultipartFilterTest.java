package com.db.dbworld.infrastructure.storage;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** The container spools multipart parts to temp before any controller runs; refuse them first. */
class MediaDiskMultipartFilterTest {

    @TempDir Path data;
    @TempDir Path disk;

    FilterChain chain = mock(FilterChain.class);

    private Path marker() {
        return disk.resolve(".dbworld-media-disk");
    }

    private MediaDiskMultipartFilter filter(String multipartLocation) {
        return new MediaDiskMultipartFilter(MediaDiskGuards.withMarker(marker(), data), multipartLocation);
    }

    private static MockHttpServletRequest upload() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/wallet/documents");
        request.setContentType("multipart/form-data; boundary=x");
        return request;
    }

    @Test
    void diskMissing_multipartIsRefusedWithTheReason_andNeverReachesTheApp() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(data.resolve("temp").toString()).doFilter(upload(), response, chain);

        verify(chain, never()).doFilter(any(), any());
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentType()).startsWith("application/json");
        assertThat(response.getContentAsString())
                .contains("The media disk is not mounted")
                .contains("Upload was not started")
                .contains("\"success\":false");
    }

    @Test
    void diskMounted_multipartPassesThrough() throws Exception {
        Files.createFile(marker());
        MockHttpServletRequest request = upload();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(data.resolve("temp").toString()).doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
    }

    @Test
    void diskMissing_nonMultipartPassesThrough() throws Exception {
        MockHttpServletRequest json = new MockHttpServletRequest("POST", "/api/wallet/documents/base64");
        json.setContentType("application/json");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(data.resolve("temp").toString()).doFilter(json, response, chain);

        verify(chain).doFilter(json, response);
    }

    /** Multipart spooled somewhere other than the media disk is none of this filter's business. */
    @Test
    void multipartLocationOutsideTheMediaTree_isLeftAlone(@TempDir Path elsewhere) throws Exception {
        MockHttpServletRequest request = upload();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter(elsewhere.toString()).doFilter(request, response, chain);
        verify(chain).doFilter(request, response);

        MockHttpServletRequest second = upload();
        filter("").doFilter(second, response, chain);
        verify(chain).doFilter(second, response);
    }
}
