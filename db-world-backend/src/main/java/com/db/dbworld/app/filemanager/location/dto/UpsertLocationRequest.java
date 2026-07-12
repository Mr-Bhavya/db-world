package com.db.dbworld.app.filemanager.location.dto;

import jakarta.validation.constraints.NotBlank;

public record UpsertLocationRequest(@NotBlank String label, @NotBlank String absolutePath,
                                    Boolean enabled, Integer sortOrder) {}
