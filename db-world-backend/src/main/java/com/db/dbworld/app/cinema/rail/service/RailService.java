package com.db.dbworld.app.cinema.rail.service;

import com.db.dbworld.cinema.enums.PageType;
import com.db.dbworld.cinema.rail.dto.RailDto;
import com.db.dbworld.cinema.rail.dto.RailPageDto;
import com.db.dbworld.cinema.rail.dto.RailRequest;
import com.db.dbworld.cinema.tmdb.genre.dto.GenreDto;

import java.util.List;

public interface RailService {

    /**
     * Returns rail metadata for a page (no records loaded).
     * If category (genreId) is provided, filters to category-relevant rails only.
     */
    List<RailDto> getRails(PageType pageType);

    List<RailDto> getRails(PageType pageType, Long category);

    /**
     * Returns paginated records for a rail.
     * If category (genreId) is provided, records are filtered to that genre.
     */
    RailPageDto getRailRecords(Long railId, int page, Integer size);

    RailPageDto getRailRecords(Long railId, int page, Integer size, Long category);

    /**
     * Returns available categories (genres) for a page type.
     */
    List<GenreDto> getCategories(PageType pageType);

    RailDto getRail(Long id);

    RailDto createRail(RailRequest request);

    RailDto updateRail(Long id, RailRequest request);

    void deleteRail(Long id);

    void addRecordToRail(Long railId, Long recordId, Integer priority);

    void removeRailItem(Long railItemId);
}
