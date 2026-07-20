package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RenameRequest {
    @NotBlank private String locationId;
    @NotBlank private String path;
    @NotBlank private String newName;
}
