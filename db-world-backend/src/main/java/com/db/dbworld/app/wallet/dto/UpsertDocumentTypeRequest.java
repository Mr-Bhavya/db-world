package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;

public record UpsertDocumentTypeRequest(@NotBlank String code, @NotBlank String displayName,
                                        String description, String iconKey, String category,
                                        boolean requiresNumber, String numberLabel,
                                        Boolean hasExpiry, Boolean active, Integer sortOrder) {}
