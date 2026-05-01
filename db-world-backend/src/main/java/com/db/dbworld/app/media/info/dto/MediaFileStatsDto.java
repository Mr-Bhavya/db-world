package com.db.dbworld.app.media.info.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class MediaFileStatsDto {
    private long total;
    private long linked;
    private long unlinked;
    private long totalSize;
    private long hdrCount;
    private long uhdCount;
}
