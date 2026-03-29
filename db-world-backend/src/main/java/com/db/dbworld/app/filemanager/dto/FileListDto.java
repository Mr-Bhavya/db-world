package com.db.dbworld.app.filemanager.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class FileListDto {
    private String currentPath;
    private String parentPath;
    private long totalItems;
    private long totalSize;
    private List<FileItemDto> items;
}
