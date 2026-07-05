package com.db.dbworld.app.stream.dto;

import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;

/**
 * Response returned by the CDN resolve endpoints.
 * The {@code cdnUrl} is a fully-formed URL the client can use directly as a
 * video {@code src} or download {@code href} — no further backend involvement
 * is required for individual byte-range requests.
 */
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CdnResolveDto(
        String cdnUrl,
        String requestId,
        String fileName,
        Long   fileSize,
        String mimeType,
        String type,
        String mediaFileId,
        Long   recordId,
        MediaFileDto mediaFile
) {}
