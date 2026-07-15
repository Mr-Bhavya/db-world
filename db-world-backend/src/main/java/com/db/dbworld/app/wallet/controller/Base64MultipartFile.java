package com.db.dbworld.app.wallet.controller;

import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * In-memory {@link MultipartFile} backed by already-decoded bytes, so the base64 JSON upload
 * endpoints can reuse the exact same {@code WalletDocumentService.create/replaceFile} validation +
 * storage path as the multipart endpoints. (Native Capacitor uploads must be base64/JSON because
 * CapacitorHttp corrupts binary multipart bodies.)
 */
class Base64MultipartFile implements MultipartFile {

    private final byte[] content;
    private final String originalFilename;
    private final String contentType;

    Base64MultipartFile(byte[] content, String originalFilename, String contentType) {
        this.content = content != null ? content : new byte[0];
        this.originalFilename = (originalFilename == null || originalFilename.isBlank()) ? "document" : originalFilename;
        this.contentType = contentType;
    }

    @Override public String getName() { return "file"; }
    @Override public String getOriginalFilename() { return originalFilename; }
    @Override public String getContentType() { return contentType; }
    @Override public boolean isEmpty() { return content.length == 0; }
    @Override public long getSize() { return content.length; }
    @Override public byte[] getBytes() { return content; }
    @Override public InputStream getInputStream() { return new ByteArrayInputStream(content); }

    @Override
    public void transferTo(File dest) throws IOException {
        Files.write(dest.toPath(), content);
    }
}
