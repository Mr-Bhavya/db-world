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
                        .description("The 10 most popular records by TMDB popularity.")
                        .automatic(true).active(true)
                        .defaultSort("popularity").defaultDirection("DESC")
                        .poolSize(10)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "FEATURED", TagDefinitionEntity.builder()
                        .tagType("FEATURED")
                        .displayName("Featured")
                        .description("High-quality records with vote average >= 7.5 and popularity >= 50.")
                        .automatic(true).active(true)
                        .defaultSort("voteAverage").defaultDirection("DESC")
                        .poolSize(50)
                        .refreshCron("0 0 */6 * * *")
                        .build(),

                "EDITOR_PICK", TagDefinitionEntity.builder()
                        .tagType("EDITOR_PICK")
                        .displayName("Editor's Pick")
                        .description("Hand-curated records selected by admins. Priority is assigned manually.")
                        .automatic(false).active(true)
                        .defaultSort("tagPriority").defaultDirection("ASC")
                        .poolSize(100)
                        .refreshCron(null)
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
