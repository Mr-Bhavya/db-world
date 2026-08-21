package com.db.dbworld.app.cinema.bootstrap.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manual catalog bootstrap, triggered by {@code GET /api/cinema/admin/bootstrap}.
 *
 * <p>Only seeds rails now. The TMDB demo-title ingestion and the FEATURED seeding that used to live
 * here had been commented out at the call site for a long time, so ~110 lines of {@code ingestMovies}
 * / {@code ingestSeries} / {@code assignTags} were unreachable; they've been removed. Real titles
 * come in through the admin catalog UI, and tags are owned by {@code TagStrategyExecutor}.
 */
@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class CatalogBootstrapService {

    private final RailBootstrapService railBootstrapService;

    public String bootstrap() {
        long start = System.currentTimeMillis();
        log.info("Catalog bootstrap started");

        String summary = railBootstrapService.generateRails();

        log.info("Catalog bootstrap completed; took={}ms", System.currentTimeMillis() - start);
        return summary;
    }
}
