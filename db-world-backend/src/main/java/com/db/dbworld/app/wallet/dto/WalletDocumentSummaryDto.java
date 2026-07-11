package com.db.dbworld.app.wallet.dto;

import java.time.Instant;
import java.time.LocalDate;

public record WalletDocumentSummaryDto(String id, String typeId, String typeCode, String typeDisplayName,
                                       String label, String maskedNumber, LocalDate issueDate,
                                       LocalDate expiryDate, String contentType, long fileSize,
                                       Instant createdAt, Instant updatedAt, boolean shared, String holderName) {}
