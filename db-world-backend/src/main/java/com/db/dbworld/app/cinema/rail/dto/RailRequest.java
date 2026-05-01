package com.db.dbworld.app.cinema.rail.dto;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import lombok.Data;

@Data
public class RailRequest {

    private String title;

    private Integer priority;

    private Boolean active;

    private Integer limitSize;

    private boolean infiniteScroll;

    private PageType pageType;

    /**
     * JSON rule string used by resolver
     */
    private RailRule rule;
}