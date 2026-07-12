package com.db.dbworld.app.filemanager.preview;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.preview.dto.TextPreviewDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TextPreviewServiceTest {

    FileLocationService locationService;
    TextPreviewService svc;
    Path base;

    @BeforeEach
    void setUp() throws Exception {
        locationService = mock(FileLocationService.class);
        base = Files.createTempDirectory("text-preview");
        when(locationService.resolveBase("l1")).thenReturn(base);
        svc = new TextPreviewService(locationService);
    }

    @Test
    void smallFile_returnsFullContent_notTruncated() throws Exception {
        Files.writeString(base.resolve("small.txt"), "hello world");

        TextPreviewDto dto = svc.readHead("l1", "/small.txt", 100);

        assertThat(dto.getContent()).isEqualTo("hello world");
        assertThat(dto.isTruncated()).isFalse();
    }

    @Test
    void largeFile_isTruncated_withContentCappedAtMaxBytes() throws Exception {
        String big = "x".repeat(1000);
        Files.writeString(base.resolve("big.txt"), big);

        TextPreviewDto dto = svc.readHead("l1", "/big.txt", 100);

        assertThat(dto.isTruncated()).isTrue();
        assertThat(dto.getContent().length()).isLessThanOrEqualTo(100);
    }

    @Test
    void defaultCap_isUsedWhenNotSpecified() throws Exception {
        Files.writeString(base.resolve("small.txt"), "hello");

        TextPreviewDto dto = svc.readHead("l1", "/small.txt");

        assertThat(dto.getContent()).isEqualTo("hello");
        assertThat(dto.isTruncated()).isFalse();
    }
}
