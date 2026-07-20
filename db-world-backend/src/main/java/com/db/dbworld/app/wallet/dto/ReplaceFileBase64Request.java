package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;

/** JSON body for PUT /api/wallet/documents/{id}/file/base64 (native base64 file replace). */
public record ReplaceFileBase64Request(
        @NotBlank String fileBase64,
        String fileName,
        String contentType
) {}
