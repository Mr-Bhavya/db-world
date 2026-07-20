package com.db.dbworld.app.wallet.controller;

import com.db.dbworld.app.wallet.dto.WalletContent;
import com.db.dbworld.core.exception.DbWorldException;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

final class WalletContentWriter {
    private WalletContentWriter() {}

    static void write(HttpServletResponse response, WalletContent content, boolean inline) {
        String filename = URLEncoder.encode(content.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        String disposition = (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + filename;
        response.setContentType(content.contentType());
        response.setHeader("Content-Disposition", disposition);
        response.setContentLengthLong(content.data().length);
        try (OutputStream out = response.getOutputStream()) {
            out.write(content.data());
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to stream document", e);
        }
    }
}
