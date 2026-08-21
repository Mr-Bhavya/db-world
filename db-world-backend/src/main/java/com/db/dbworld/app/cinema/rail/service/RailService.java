package com.db.dbworld.app.cinema.rail.service;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.dto.RailDto;
import com.db.dbworld.app.cinema.rail.dto.RailPageDto;
import com.db.dbworld.app.cinema.rail.dto.RailRequest;
import com.db.dbworld.app.cinema.tmdb.genre.dto.GenreDto;

import java.util.List;

public interface RailService {

    /**
     * Returns rail metadata for a page (no records loaded).
     * If category (genreId) is provided, filters to category-relevant rails only.
     * Used by the public /home /movies /series endpoints — drops inactive rails
     * and rails whose rule resolves to zero records.
     */
    List<RailDto> getRails(PageType pageType);

    List<RailDto> getRails(PageType pageType, Long category);

    /**
     * Admin variant: returns every rail (active or not, content or not) so the
     * admin Rails Tab can re-enable disabled rails and surface newly-created
     * rails that haven't matched any records yet.
     */
    List<RailDto> getAllRails(PageType pageType);

    /**
     * Returns paginated records for a rail.
     * If category (genreId) is provided, records are filtered to that genre.
     */
    RailPageDto getRailRecords(Long railId, int page, Integer size);

    RailPageDto getRailRecords(Long railId, int page, Integer size, Long category);

    /**
     * Page-aware record loader. {@code requestedPage} drives record-type filtering for
     * multi-page rails (e.g. Continue Watching on the Movies page only returns movies).
     */
    RailPageDto getRailRecords(Long railId, int page, Integer size, Long category, PageType requestedPage);

    /**
     * Returns available categories (genres) for a page type.
     */
    List<GenreDto> getCategories(PageType pageType);

    /**
     * Returns the current user's watchlisted records as a rail page (most recent first).
     * Returns an empty record list when nothing is watchlisted.
     */
    RailPageDto getWatchlistRecords(Long userId, int page, int size);

    RailDto getRail(Long id);

    RailDto createRail(RailRequest request);

    RailDto updateRail(Long id, RailRequest request);

    void deleteRail(Long id);

    /**
     * Applies a new display order in one transaction.
     *
     * <p>Replaces the frontend's previous approach of firing one full PUT per rail — dragging a
     * single rail in a 30-rail list sent 30 requests, each rewriting that rail's entire JSON rule,
     * and a partial failure left priorities inconsistent. Only {@code priority} is touched here.
     *
     * @param order rail id → new priority
     * @return how many rails actually changed position
     */
    int reorderRails(java.util.Map<Long, Integer> order);

    void addRecordToRail(Long railId, Long recordId, Integer priority);

    void removeRailItem(Long railItemId);
}
