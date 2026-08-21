package com.db.dbworld.app.cinema.catalog.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RecordTagDto {

    private Long id;

    private Long recordId;

    private String tagType;

    private Integer priority;

}