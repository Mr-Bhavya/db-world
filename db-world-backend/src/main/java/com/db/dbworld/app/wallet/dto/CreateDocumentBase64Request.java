package com.db.dbworld.app.wallet.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.validation.constraints.NotBlank;

import java.time.LocalDate;

/**
 * JSON body for POST /api/wallet/documents/base64 — the base64 upload path used by native clients
 * (CapacitorHttp corrupts binary multipart bodies, so the file rides as base64 which is ASCII-safe).
 */
public record CreateDocumentBase64Request(
        @NotBlank String fileBase64,
        String fileName,
        String contentType,
        @NotBlank String typeId,
        String label,
        String number,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate issueDate,
        @JsonFormat(pattern = "yyyy-MM-dd") LocalDate expiryDate,
        String notes,
        String holder
) {}
