package com.db.dbworld.app.cinema.rail.dto;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import lombok.Data;

import java.util.Set;

@Data
public class RailRequest {

    private String title;

    private Integer priority;

    private Boolean active;

    private Integer limitSize;

    private boolean infiniteScroll;

    /** Pages this rail should appear on. Must contain at least one entry. */
    private Set<PageType> pageTypes;

    /**
     * JSON rule string used by resolver
     */
    private RailRule rule;
}