package com.db.dbworld.app.filemanager.preview.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TextPreviewDto {
    private String content;
    private boolean truncated;
}
