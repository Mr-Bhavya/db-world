package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionRepository;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Manages {@link TagDefinitionEntity} — the single source of truth for each tag's
 * display configuration, default sort order, pool size, and scheduler settings.
 *
 * <p>On application startup, missing rows are automatically seeded with sensible defaults.
 * Admins can update them at runtime via the admin API without redeploying.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagDefinitionService {

    private final TagDefinitionRepository repository;

    // ── Hard-coded defaults per tag ──────────────────────────────────────────

    private static final Map<String, TagDefinitionEntity> DEFAULTS = buildDefaults();

    private static Map<String, TagDefinitionEntity> buildDefaults() {
        return Map.of(
                "TRENDING", TagDefinitionEntity.builder()
                        .tagType("TRENDING")
                        .displayName("Trending")
                        .description("Records with the highest time-decayed popularity score. Refreshed every 6 hours.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(60)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "TOP_10", TagDefinitionEntity.builder()
                        .tagType("TOP_10")
                        .displayName("Top 10")
                        .description("Top 20 records by time-decayed popularity (60-day half-life). Rail limitSize=10 picks the visible 10.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(20)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "FEATURED", TagDefinitionEntity.builder()
                        .tagType("FEATURED")
                        .displayName("Featured")
                        .description("High-quality records (vote_avg >= 7.5, popularity >= 50) scored by (quality * 10 + popularity * 0.1) with 90-day decay.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(50)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "EDITOR_PICK", TagDefinitionEntity.builder()
                        .tagType("EDITOR_PICK")
                        .displayName("Editor's Pick")
                        .description("Critically acclaimed content (vote_avg >= 8.0, vote_count >= 500) scored by (quality * 10 + count * 0.01) with 120-day decay. Admin can supplement manually.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(30)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "RECENTLY_ADDED", TagDefinitionEntity.builder()
                        .tagType("RECENTLY_ADDED")
                        .displayName("Recently Added")
                        .description("Records added to the catalog within the last 30 days.")
                        .automatic(true).active(true)
                        .defaultSort("createdAt").defaultDirection("DESC")
                        .poolSize(50)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "AVAILABLE_FOR_DOWNLOAD", TagDefinitionEntity.builder()
                        .tagType("AVAILABLE_FOR_DOWNLOAD")
                        .displayName("Available for Download")
                        .description("Records that have at least one downloadable media file.")
                        .automatic(true).active(true)
                        .defaultSort("createdAt").defaultDirection("DESC")
                        .poolSize(200)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "NEW_SEASON", TagDefinitionEntity.builder()
                        .tagType("NEW_SEASON")
                        .displayName("New Season")
                        .description("TV shows that gained a brand-new season within the last 30 days (set at ingest, not re-uploads).")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(60)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "NEW_EPISODE", TagDefinitionEntity.builder()
                        .tagType("NEW_EPISODE")
                        .displayName("New Episode")
                        .description("TV shows that gained a new episode within the last 30 days (set at ingest, not re-uploads).")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .poolSize(60)
                        .refreshCron("0 0 */6 * * *")
                        .build()
        );
    }

    // ── Startup initialization ───────────────────────────────────────────────

    /**
     * Seeds missing {@link TagDefinitionEntity} rows on application startup.
     * Existing rows are NOT overwritten — admin changes survive restarts.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeDefaults() {
        Arrays.stream(RecordTagType.values()).forEach(type -> {
            String key = type.name();
            if (!repository.existsById(key)) {
                TagDefinitionEntity def = Optional.ofNullable(DEFAULTS.get(key))
                        .orElse(buildFallback(key));
                repository.save(def);
                log.debug("Seeded TagDefinition for {}", key);
            }
        });
    }

    // ── Query ────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TagDefinitionEntity> findAll() {
        return repository.findAll();
    }

    /**
     * Returns the definition for the given tag type.
     * Falls back to a hard-coded default if the DB row is missing.
     */
    @Transactional(readOnly = true)
    public TagDefinitionEntity getOrDefault(String tagType) {
        return repository.findById(tagType)
                .orElseGet(() -> Optional.ofNullable(DEFAULTS.get(tagType))
                        .orElse(buildFallback(tagType)));
    }

    // ── Update ───────────────────────────────────────────────────────────────

    @Transactional
    public TagDefinitionEntity update(String tagType, String displayName, String description,
                                      boolean active, String defaultSort, String defaultDirection,
                                      int poolSize, String refreshCron) {
        TagDefinitionEntity entity = repository.findById(tagType)
                .orElseGet(() -> Optional.ofNullable(DEFAULTS.get(tagType))
                        .orElse(buildFallback(tagType)));

        entity.setDisplayName(displayName);
        entity.setDescription(description);
        entity.setActive(active);
        entity.setDefaultSort(defaultSort);
        entity.setDefaultDirection(defaultDirection);
        entity.setPoolSize(poolSize);
        entity.setRefreshCron(refreshCron);
        entity.setUpdatedAt(LocalDateTime.now());

        return repository.save(entity);
    }

    /**
     * Records a successful scheduler refresh for this tag.
     */
    @Transactional
    public void markRefreshed(String tagType) {
        repository.findById(tagType).ifPresent(def -> {
            def.setLastRefreshedAt(LocalDateTime.now());
            repository.save(def);
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static TagDefinitionEntity buildFallback(String tagType) {
        return TagDefinitionEntity.builder()
                .tagType(tagType)
                .displayName(tagType)
                .automatic(true)
                .active(true)
                .defaultSort("popularity")
                .defaultDirection("DESC")
                .poolSize(30)
                .refreshCron("0 0 */6 * * *")
                .build();
    }
}
