package com.db.dbworld.app.wallet.service;

import lombok.extern.log4j.Log4j2;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.stereotype.Component;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Optional;

/**
 * Best-effort generator of small JPEG thumbnails for wallet documents.
 * <p>
 * Thumbnail generation must NEVER break an upload: any failure (corrupt file,
 * unsupported encoding, OOM on a huge page, etc.) is caught and swallowed —
 * callers get an empty {@link Optional} and simply skip storing a thumbnail.
 */
@Log4j2
@Component
public class WalletThumbnailer {

    private static final int MAX_DIMENSION = 400;

    public Optional<byte[]> generate(byte[] source, String contentType) {
        try {
            BufferedImage img;
            if (contentType != null && contentType.startsWith("image/")) {
                img = ImageIO.read(new ByteArrayInputStream(source));
            } else if ("application/pdf".equals(contentType)) {
                img = renderPdfFirstPage(source);
            } else {
                img = null;
            }
            if (img == null) {
                return Optional.empty();
            }
            return Optional.of(toJpegThumbnail(img));
        } catch (Exception e) {
            log.warn("Wallet thumbnail generation failed for contentType={}", contentType, e);
            return Optional.empty();
        }
    }

    private static BufferedImage renderPdfFirstPage(byte[] source) throws Exception {
        try (PDDocument doc = Loader.loadPDF(source)) {
            if (doc.getNumberOfPages() == 0) {
                return null;
            }
            return new PDFRenderer(doc).renderImageWithDPI(0, 72, ImageType.RGB);
        }
    }

    private static byte[] toJpegThumbnail(BufferedImage img) throws Exception {
        int w = img.getWidth();
        int h = img.getHeight();
        double scale = Math.min(1.0, MAX_DIMENSION / (double) Math.max(w, h));
        int targetW = Math.max(1, (int) Math.round(w * scale));
        int targetH = Math.max(1, (int) Math.round(h * scale));

        BufferedImage scaled = new BufferedImage(targetW, targetH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = scaled.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            // JPEG has no alpha channel — paint a white background first so any
            // transparent source pixels don't come out black.
            g.setColor(java.awt.Color.WHITE);
            g.fillRect(0, 0, targetW, targetH);
            g.drawImage(img, 0, 0, targetW, targetH, null);
        } finally {
            g.dispose();
        }

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(scaled, "jpg", baos);
        return baos.toByteArray();
    }
}
