package com.db.dbworld.app.cinema.rail.service;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;

import java.util.List;

public interface RailResolver {

    List<RecordEntity> resolve(RailEntity rail);

    Slice<RecordEntity> resolveSlice(RailEntity rail, Pageable pageable);

    Slice<Long> resolveIds(RailEntity rail, Pageable pageable);

    /**
     * Resolves record IDs with an optional category (genre) filter.
     * When category is non-null, records are additionally filtered to that genre.
     */
    Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category);

    /**
     * Page-aware resolution. {@code requestedPage} is the page the caller is rendering
     * (HOME, MOVIES, or SERIES) and drives record-type filtering for multi-page rails.
     * When null, falls back to the rail's first pageType.
     */
    Slice<Long> resolveIds(RailEntity rail, Pageable pageable, Long category, PageType requestedPage);

    String getRuleType(RailEntity rail);

}
