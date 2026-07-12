package com.db.dbworld.app.filemanager.preview;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.wallet.service.WalletThumbnailer;
import com.db.dbworld.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ThumbnailServiceTest {

    FileLocationService locationService;
    AppProperties appProperties;
    ThumbnailService svc;
    Path base;
    Path tempPath;

    @BeforeEach
    void setUp() throws Exception {
        locationService = mock(FileLocationService.class);
        appProperties = mock(AppProperties.class);
        base = Files.createTempDirectory("thumbs-src");
        tempPath = Files.createTempDirectory("thumbs-tmp");
        when(locationService.resolveBase("l1")).thenReturn(base);
        when(appProperties.getTempPath()).thenReturn(tempPath);

        BufferedImage img = new BufferedImage(50, 50, BufferedImage.TYPE_INT_RGB);
        ImageIO.write(img, "png", base.resolve("pic.png").toFile());

        svc = new ThumbnailService(locationService, new WalletThumbnailer(), appProperties);
    }

    @Test
    void generatesNonEmptyJpegThumbnail() throws Exception {
        byte[] jpeg = svc.thumbnail("l1", "/pic.png");

        assertThat(jpeg).isNotEmpty();
        // JPEG magic bytes
        assertThat(jpeg[0]).isEqualTo((byte) 0xFF);
        assertThat(jpeg[1]).isEqualTo((byte) 0xD8);
    }

    @Test
    void secondCall_readsFromCache() throws Exception {
        byte[] first = svc.thumbnail("l1", "/pic.png");

        Path cacheDir = tempPath.resolve("fm-thumbs");
        long cachedCountAfterFirst;
        try (var list = Files.list(cacheDir)) {
            cachedCountAfterFirst = list.count();
        }
        assertThat(cachedCountAfterFirst).isEqualTo(1);

        byte[] second = svc.thumbnail("l1", "/pic.png");

        assertThat(second).isEqualTo(first);
        long cachedCountAfterSecond;
        try (var list = Files.list(cacheDir)) {
            cachedCountAfterSecond = list.count();
        }
        assertThat(cachedCountAfterSecond).isEqualTo(1);
    }
}
