package com.db.dbworld.app.ipo.service;

import com.db.dbworld.app.ipo.entity.IpoListingEntity;
import com.db.dbworld.app.ipo.repository.IpoListingRepository;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Populates {@code ipo_listing.alias_key} for rows that predate the column.
 *
 * <p>Deliberately Java rather than a line of backfill SQL: the alias rule (ampersand folding,
 * punctuation as a separator, abbreviation expansion, trailing legal suffixes, whitespace squash)
 * is non-trivial and lives in {@link IpoNormalizer}. A SQL reimplementation would be a second copy
 * that drifts from the first, and the failure mode of drift is silent — rows simply stop resolving
 * to each other again.
 *
 * <p>Runs once per boot over rows whose alias is null plus live rows whose stored alias no longer
 * matches the current rule, so a rule change re-keys existing rows and newly detectable duplicates
 * surface in the admin duplicate report (they are never merged automatically). Failure is logged
 * and swallowed: an unresolved alias degrades de-duplication back to the previous
 * {@code matchKey}-only behaviour, which is not worth refusing to start the application over.
 */
@Log4j2
@Component
public class IpoAliasKeyBackfill {

    /** Rows saved per flush — bounded so a large first run cannot balloon the persistence context. */
    private static final int BATCH_SIZE = 200;

    private final IpoListingRepository listingRepo;
    private final IpoNormalizer normalizer;

    public IpoAliasKeyBackfill(IpoListingRepository listingRepo, IpoNormalizer normalizer) {
        this.listingRepo = listingRepo;
        this.normalizer = normalizer;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void backfillOnStartup() {
        try {
            int updated = backfill();
            if (updated > 0) {
                log.info("IPO alias-key backfill: populated alias_key for {} listing(s)", updated);
            }
        } catch (Exception e) {
            log.warn("IPO alias-key backfill failed - de-duplication stays matchKey-only until the "
                    + "next boot: {}", e.toString());
        }
    }

    /**
     * @return how many rows were given a new alias key. Covers rows that never had one and live rows
     * whose stored alias was computed by an older version of the rule. Visible for tests.
     */
    @Transactional
    public int backfill() {
        Map<String, IpoListingEntity> candidates = new LinkedHashMap<>();
        listingRepo.findByAliasKeyIsNull().forEach(e -> candidates.put(e.getId(), e));
        listingRepo.findAllLive().forEach(e -> candidates.putIfAbsent(e.getId(), e));
        List<IpoListingEntity> batch = new ArrayList<>(BATCH_SIZE);
        int updated = 0;
        for (IpoListingEntity entity : candidates.values()) {
            String alias = normalizer.aliasKey(entity.getCompanyName());
            if (alias == null || alias.equals(entity.getAliasKey())) {
                continue;
            }
            entity.setAliasKey(alias);
            batch.add(entity);
            updated++;
            if (batch.size() >= BATCH_SIZE) {
                listingRepo.saveAll(batch);
                batch.clear();
            }
        }
        if (!batch.isEmpty()) {
            listingRepo.saveAll(batch);
        }
        return updated;
    }
}
