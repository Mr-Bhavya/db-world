package com.db.dbworld.app.filemanager.upload.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * JSON body for the native base64 chunk upload (PUT /uploads/{id}/chunk/base64). Native clients must
 * use this: CapacitorHttp mangles binary octet-stream request bodies, which changed the chunk's byte
 * length and produced "Upload incomplete: size mismatch". base64 is ASCII and survives intact.
 */
public record ChunkBase64Request(
        int index,
        @NotBlank String dataBase64
) {}
