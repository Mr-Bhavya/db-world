package com.db.dbworld.app.cinema.rail.migration;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.repository.RailRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.List;

/**
 * One-shot migration: copy the legacy single {@code page_type} column into the new
 * {@code rails_page_types} join table for any rail whose set is empty. Runs once on
 * each startup until every rail has at least one page in its set, then stays a no-op.
 *
 * <p>Safe to leave in place forever — it only touches rails with an empty
 * {@code pageTypes} collection.
 */
@Component
@RequiredArgsConstructor
@Log4j2
public class RailPageTypesMigrator {

    private final RailRepository railRepository;

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    @SuppressWarnings("deprecation")
    public void backfill() {
        List<RailEntity> rails = railRepository.findAll();
        int migrated = 0;

        for (RailEntity rail : rails) {
            if (rail.getPageTypes() != null && !rail.getPageTypes().isEmpty()) continue;

            PageType legacy = rail.getPageType() != null ? rail.getPageType() : PageType.HOME;
            rail.setPageTypes(EnumSet.of(legacy));
            migrated++;
        }

        if (migrated > 0) {
            railRepository.saveAll(rails);
            log.info("Migrated {} rails: legacy pageType → pageTypes set", migrated);
        }
    }
}
