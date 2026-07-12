package com.db.dbworld.app.filemanager.preview;

import com.db.dbworld.app.filemanager.location.FileLocationService;
import com.db.dbworld.app.filemanager.path.PathJail;
import com.db.dbworld.app.filemanager.preview.dto.TextPreviewDto;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;

/** Reads the leading bytes of a text/code file for inline preview, capping the amount read. */
@Log4j2
@Service
@RequiredArgsConstructor
public class TextPreviewService {

    public static final int DEFAULT_MAX_BYTES = 262_144; // 256 KiB

    private final FileLocationService locationService;

    public TextPreviewDto readHead(String locationId, String path) throws IOException {
        return readHead(locationId, path, DEFAULT_MAX_BYTES);
    }

    public TextPreviewDto readHead(String locationId, String path, int maxBytes) throws IOException {
        log.debug("readHead locationId={} path={} maxBytes={}", locationId, path, maxBytes);
        Path base = locationService.resolveBase(locationId);
        Path file;
        try {
            file = PathJail.resolveReal(base, path);
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.NOT_FOUND, "File not found: " + path);
        }
        if (!Files.isRegularFile(file)) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Not a file: " + path);
        }

        int cap = maxBytes > 0 ? maxBytes : DEFAULT_MAX_BYTES;
        long size = Files.size(file);
        boolean truncated = size > cap;

        byte[] bytes;
        if (truncated) {
            bytes = new byte[cap];
            try (InputStream in = Files.newInputStream(file)) {
                int read = 0;
                int n;
                while (read < cap && (n = in.read(bytes, read, cap - read)) != -1) {
                    read += n;
                }
                if (read < cap) bytes = Arrays.copyOf(bytes, read);
            }
        } else {
            bytes = Files.readAllBytes(file);
        }

        return TextPreviewDto.builder()
                .content(new String(bytes, StandardCharsets.UTF_8))
                .truncated(truncated)
                .build();
    }
}
