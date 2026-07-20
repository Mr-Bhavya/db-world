package com.db.dbworld.app.filemanager.upload.dto;

import jakarta.validation.constraints.NotBlank;

public record InitUploadRequest(@NotBlank String locationId, @NotBlank String path, @NotBlank String fileName,
                                long totalSize, Integer chunkSize, String checksum, String onConflict) {}
