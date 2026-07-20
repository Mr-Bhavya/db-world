package com.db.dbworld.app.wallet.dto;

import jakarta.validation.constraints.NotBlank;

public record UpsertDocumentTypeRequest(@NotBlank String code, @NotBlank String displayName,
                                        String description, String iconKey, boolean requiresNumber,
                                        String numberLabel, Boolean active, Integer sortOrder) {}
