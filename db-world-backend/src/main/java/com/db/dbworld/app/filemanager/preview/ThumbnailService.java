package com.db.dbworld.app.filemanager.preview;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.mapper.FileMetadataMapper;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.app.wallet.service.WalletThumbnailer;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Generates and caches small JPEG thumbnails for previewable files.
 * <p>
 * Images and PDFs reuse {@link WalletThumbnailer} (already downscales to a small JPEG) rather than
 * duplicating ImageIO/PDFBox downscale logic. Video first-frame extraction is not wired up — it's
 * best-effort per the design and the frontend falls back to a generic icon for unsupported types.
 * Never throws a 500 for an unrenderable file: unsupported/broken input surfaces as 404.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class ThumbnailService {

    private static final String CACHE_DIR_NAME = "fm-thumbs";

    /** Source files larger than this are never loaded into memory for thumbnailing. */
    private static final long MAX_THUMBNAIL_SOURCE_BYTES = 52_428_800; // 50 MB

    private final FileLocationService locationService;
    private final WalletThumbnailer walletThumbnailer;
    private final AppProperties appProperties;

    public byte[] thumbnail(String locationId, String path) throws IOException {
        log.debug("thumbnail locationId={} path={}", locationId, path);
        Path base = locationService.resolveBase(locationId);
        Path file;
        try {
            file = PathJail.resolveReal(base, path);
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "File not found: " + path);
        }
        if (!Files.isRegularFile(file)) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "Not a file: " + path);
        }
        if (Files.size(file) > MAX_THUMBNAIL_SOURCE_BYTES) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "File too large for thumbnail: " + path);
        }

        BasicFileAttributes attrs = Files.readAttributes(file, BasicFileAttributes.class);
        Path cacheDir = appProperties.getTempPath().resolve(CACHE_DIR_NAME);
        Files.createDirectories(cacheDir);
        String cacheKey = sha1(locationId + path + attrs.lastModifiedTime().toMillis());
        Path cached = cacheDir.resolve(cacheKey + ".jpg");
        if (Files.isRegularFile(cached)) {
            return Files.readAllBytes(cached);
        }

        String name = file.getFileName().toString();
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
        String mime = FileMetadataMapper.guessMime(ext);

        if (!mime.startsWith("image/") && !"application/pdf".equals(mime)) {
            // Video first-frame + other types unsupported for now; caller/frontend shows an icon instead.
            throw new DbWorldException(HttpStatus.NOT_FOUND, "No thumbnail available for: " + path);
        }

        byte[] source = Files.readAllBytes(file);
        byte[] jpeg = walletThumbnailer.generate(source, mime)
                .orElseThrow(() -> new DbWorldException(HttpStatus.NOT_FOUND, "Could not render thumbnail for: " + path));

        Files.write(cached, jpeg);
        return jpeg;
    }

    private static String sha1(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-1 not available", e);
        }
    }
}
