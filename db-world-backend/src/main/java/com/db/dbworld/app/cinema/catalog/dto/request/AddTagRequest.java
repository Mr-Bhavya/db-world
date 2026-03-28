package com.db.dbworld.app.cinema.catalog.dto.request;

import com.db.dbworld.cinema.enums.RecordTagType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AddTagRequest {

    @NotNull
    private RecordTagType tagType;

    private Integer priority;
}