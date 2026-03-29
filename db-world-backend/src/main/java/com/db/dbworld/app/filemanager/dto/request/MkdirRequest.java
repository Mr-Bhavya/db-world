package com.db.dbworld.app.filemanager.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MkdirRequest {
    @NotBlank private String path;
    @NotBlank private String name;
}
