package com.db.dbworld.app.cinema.catalog.dto;

import com.db.dbworld.cinema.enums.RecordTagType;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RecordTagDto {

    private Long id;

    private Long recordId;

    private RecordTagType tagType;

    private Integer priority;

}