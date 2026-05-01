package com.db.dbworld.app.cinema.rail.dto;

import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RailDto {

    private Long id;

    private String title;

    private Integer priority;

    private Boolean active;

    private Integer limitSize;

    private boolean infiniteScroll;

    private PageType pageType;

    private RailRule rule;

    private List<RecordDto> records;
}