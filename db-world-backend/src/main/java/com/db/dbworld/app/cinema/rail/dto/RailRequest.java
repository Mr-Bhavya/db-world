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

    /**
     * Legacy single-page field. Optional. If {@link #pageTypes} is null/empty the
     * service falls back to this so older admin clients continue to work.
     */
    @Deprecated
    private PageType pageType;

    /**
     * Pages this rail should appear on. Preferred over {@link #pageType}. May be empty
     * during creation by legacy clients — service derives a default.
     */
    private Set<PageType> pageTypes;

    /**
     * JSON rule string used by resolver
     */
    private RailRule rule;
}