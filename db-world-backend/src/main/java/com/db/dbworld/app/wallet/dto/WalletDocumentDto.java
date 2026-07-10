package com.db.dbworld.app.wallet.dto;

import java.time.Instant;
import java.time.LocalDate;

public record WalletDocumentDto(String id, String typeId, String typeCode, String typeDisplayName,
                                String label, String documentNumber, LocalDate issueDate,
                                LocalDate expiryDate, String notes, String originalFileName,
                                String contentType, long fileSize, Instant createdAt, Instant updatedAt) {}
