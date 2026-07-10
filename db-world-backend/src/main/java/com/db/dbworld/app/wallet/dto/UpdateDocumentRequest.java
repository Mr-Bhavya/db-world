package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record UpdateDocumentRequest(@NotBlank String label, String documentNumber,
                                    LocalDate issueDate, LocalDate expiryDate, String notes) {}
