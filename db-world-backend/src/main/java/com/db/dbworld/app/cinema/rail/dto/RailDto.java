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
import java.util.Set;

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

    /**
     * Legacy single-page field. Mirrors the first element of {@link #pageTypes} for
     * older admin clients. New clients should read {@link #pageTypes}.
     */
    @Deprecated
    private PageType pageType;

    /** Pages this rail appears on. */
    private Set<PageType> pageTypes;

    private RailRule rule;

    private List<RecordDto> records;
}