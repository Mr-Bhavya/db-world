package com.db.dbworld.app.wallet.service;

import org.junit.jupiter.api.Test;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class WalletThumbnailerTest {

    private final WalletThumbnailer thumbnailer = new WalletThumbnailer();

    @Test
    void generate_forValidImage_returnsScaledJpeg() throws Exception {
        BufferedImage source = new BufferedImage(800, 600, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(source, "png", baos);

        Optional<byte[]> result = thumbnailer.generate(baos.toByteArray(), "image/png");

        assertThat(result).isPresent();
        BufferedImage thumb = ImageIO.read(new ByteArrayInputStream(result.get()));
        assertThat(thumb).isNotNull();
        assertThat(Math.max(thumb.getWidth(), thumb.getHeight())).isLessThanOrEqualTo(400);
    }

    @Test
    void generate_forGarbageBytes_returnsEmpty() {
        Optional<byte[]> result = thumbnailer.generate("notanimage".getBytes(), "image/png");
        assertThat(result).isEmpty();
    }

    @Test
    void generate_forUnsupportedContentType_returnsEmpty() {
        Optional<byte[]> result = thumbnailer.generate("hello world".getBytes(), "text/plain");
        assertThat(result).isEmpty();
    }
}
