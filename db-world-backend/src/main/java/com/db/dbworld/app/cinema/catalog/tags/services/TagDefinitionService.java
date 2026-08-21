package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionRepository;
import com.db.dbworld.app.cinema.catalog.tags.rule.TagRule;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategy;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityNotFoundException;
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
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Manages {@link TagDefinitionEntity} — the single source of truth for each tag's
 * display configuration, default sort order, and whether the scheduler refreshes it.
 *
 * <p>On application startup, missing rows are automatically seeded with sensible defaults.
 * Admins can update them at runtime via the admin API without redeploying.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TagDefinitionService {

    private final TagDefinitionRepository repository;
    private final RecordTagRepository recordTagRepository;

    /**
     * Every registered {@link TagStrategy}. Injected directly rather than via
     * {@code TagStrategyExecutor} — the executor depends on this service, so going through it
     * would be a circular dependency. Strategies themselves depend on nothing.
     */
    private final List<TagStrategy> strategies;

    // ── Hard-coded defaults per tag ──────────────────────────────────────────

    private static final Map<String, TagDefinitionEntity> DEFAULTS = buildDefaults();

    private static Map<String, TagDefinitionEntity> buildDefaults() {
        return Map.ofEntries(
                Map.entry("TRENDING", TagDefinitionEntity.builder()
                        .tagType("TRENDING")
                        .displayName("Trending")
                        .description("Records with the highest time-decayed popularity score. Refreshed every 6 hours.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build()),

                Map.entry("TOP_10", TagDefinitionEntity.builder()
                        .tagType("TOP_10")
                        .displayName("Top 10")
                        .description("Top 20 records by time-decayed popularity (60-day half-life). Rail limitSize=10 picks the visible 10.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build()),

                Map.entry("FEATURED", TagDefinitionEntity.builder()
                        .tagType("FEATURED")
                        .displayName("Featured")
                        .description("High-quality records (vote_avg >= 7.5, popularity >= 50) scored by (quality * 10 + popularity * 0.1) with 90-day decay.")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build()),

                Map.entry("EDITOR_PICK", TagDefinitionEntity.builder()
                        .tagType("EDITOR_PICK")
                        .displayName("Editor's Pick")
                        .description("Hand-picked by an admin. The only fully manual tag — nothing recomputes it, so records you add here stay until you remove them.")
                        .automatic(false).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build()),

                Map.entry("RECENTLY_ADDED", TagDefinitionEntity.builder()
                        .tagType("RECENTLY_ADDED")
                        .displayName("Recently Added")
                        .description("Records added to the catalog within the last 30 days.")
                        .automatic(true).active(true)
                        .defaultSort("createdAt").defaultDirection("DESC")
                        .build()),

                Map.entry("AVAILABLE_FOR_DOWNLOAD", TagDefinitionEntity.builder()
                        .tagType("AVAILABLE_FOR_DOWNLOAD")
                        .displayName("Available for Download")
                        .description("Records that have at least one downloadable media file.")
                        .automatic(true).active(true)
                        .defaultSort("createdAt").defaultDirection("DESC")
                        .build()),

                Map.entry("NEW_SEASON", TagDefinitionEntity.builder()
                        .tagType("NEW_SEASON")
                        .displayName("New Season")
                        .description("TV shows that gained a brand-new season within the last 30 days (set at ingest, not re-uploads).")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build()),

                Map.entry("NEW_EPISODE", TagDefinitionEntity.builder()
                        .tagType("NEW_EPISODE")
                        .displayName("New Episode")
                        .description("TV shows that gained a new episode within the last 30 days (set at ingest, not re-uploads).")
                        .automatic(true).active(true)
                        .defaultSort("tagPriority").defaultDirection("DESC")
                        .build())
        );
    }

    // ── Startup initialization ───────────────────────────────────────────────

    /**
     * Seeds missing {@link TagDefinitionEntity} rows on application startup, and reconciles the
     * {@code automatic} flag on existing ones against the registered strategies.
     *
     * <p>Everything an admin owns — display name, description, active, default sort — is left alone,
     * so their edits survive restarts. {@code automatic} is the exception: it is not an admin choice
     * but a fact about whether code exists to compute the tag. Deleting a strategy has to flip its
     * tag to manual on already-seeded databases, otherwise the admin UI keeps calling it
     * "auto-managed" and hiding the controls needed to curate it by hand.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeDefaults() {
        Set<String> managed = strategies.stream()
                .map(s -> s.tagType().name())
                .collect(Collectors.toUnmodifiableSet());

        Arrays.stream(RecordTagType.values()).forEach(type -> {
            String key = type.name();

            TagDefinitionEntity existing = repository.findById(key).orElse(null);
            // A rule-driven tag is automatic even with no strategy bean behind it.
            boolean automatic = managed.contains(key)
                    || (existing != null && existing.getRule() != null && !existing.getRule().isEmpty());
            if (existing == null) {
                TagDefinitionEntity def = Optional.ofNullable(DEFAULTS.get(key))
                        .orElse(buildFallback(key));
                def.setAutomatic(automatic);
                repository.save(def);
                log.debug("Seeded TagDefinition for {}", key);
            } else if (existing.isAutomatic() != automatic) {
                existing.setAutomatic(automatic);
                repository.save(existing);
                log.info("TagDefinition {} switched to {} — strategy {}", key,
                        automatic ? "automatic" : "manual",
                        automatic ? "registered" : "removed");
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

    /** True when a definition row exists for this exact tag name. */
    @Transactional(readOnly = true)
    public boolean exists(String tagType) {
        return tagType != null && repository.existsById(tagType);
    }

    /** Tag names that have a registered {@link TagStrategy} — i.e. code computes them. */
    private Set<String> strategyOwned() {
        return strategies.stream()
                .map(s -> s.tagType().name())
                .collect(Collectors.toUnmodifiableSet());
    }

    /**
     * The single definition of "automatic": something recomputes this tag's membership, so anything
     * an admin adds by hand will be erased on the next scheduler run.
     *
     * <p>Two ways to qualify — a {@link TagStrategy} bean (the eight built-ins), or an admin-authored
     * {@link TagRule}. Everything else is manual. Both the admin UI's read-only treatment and
     * {@code TagAdminService}'s write guards resolve through here, so they can't disagree.
     */
    public boolean isAutomatic(TagDefinitionEntity def) {
        if (def == null) return false;
        return strategyOwned().contains(def.getTagType())
                || (def.getRule() != null && !def.getRule().isEmpty());
    }

    @Transactional(readOnly = true)
    public boolean isAutomatic(String tagType) {
        return isAutomatic(repository.findById(tagType).orElse(null));
    }

    // ── Create / delete (admin-defined tags) ─────────────────────────────────

    /**
     * Creates a new admin-curated tag.
     *
     * <p>Always manual: there is no strategy behind it, so nothing recomputes or clears it, and
     * whatever an admin bulk-adds stays until they remove it. The name is slugged to UPPER_SNAKE
     * (see {@link TagNames}) while {@code displayName} keeps the human wording.
     *
     * @throws IllegalArgumentException if the name is unusable or already taken
     */
    @Transactional
    public TagDefinitionEntity create(String rawName, String displayName, String description,
                                      String defaultSort, String defaultDirection, TagRule rule) {
        String tagType = TagNames.canonicalize(rawName);
        if (tagType == null) {
            throw new IllegalArgumentException("Tag name must contain at least one letter or digit");
        }
        if (repository.existsById(tagType)) {
            throw new IllegalArgumentException("A tag named '" + tagType + "' already exists");
        }

        String label = (displayName == null || displayName.isBlank()) ? rawName.trim() : displayName.trim();

        TagRule effectiveRule = (rule == null || rule.isEmpty()) ? null : rule;

        TagDefinitionEntity entity = TagDefinitionEntity.builder()
                .tagType(tagType)
                .displayName(label)
                .description(description)
                // A rule makes the tag automatic; without one it is a manual list.
                .automatic(effectiveRule != null)
                .rule(effectiveRule)
                .active(true)
                .defaultSort(defaultSort == null || defaultSort.isBlank() ? "tagPriority" : defaultSort)
                .defaultDirection(defaultDirection == null || defaultDirection.isBlank() ? "DESC" : defaultDirection)
                .build();

        TagDefinitionEntity saved = repository.save(entity);
        log.info("Tag created; tagType={}, displayName={}, automatic={}",
                tagType, label, effectiveRule != null);
        return saved;
    }

    /**
     * Deletes an admin-created tag and every {@code record_tags} row carrying it.
     *
     * <p>Built-ins are refused: a {@link TagStrategy} would simply re-seed the definition on the
     * next boot, leaving a half-deleted tag. Rails still pointing at a deleted tag are left alone
     * and render empty — the rail list shows the dangling name so it can be repointed or removed.
     *
     * @return how many record_tags rows were removed
     */
    @Transactional
    public long delete(String tagType) {
        String canonical = TagNames.canonicalize(tagType);
        if (canonical == null || !repository.existsById(canonical)) {
            throw new EntityNotFoundException("Unknown tag type: " + tagType);
        }
        if (RecordTagType.isBuiltIn(canonical)) {
            throw new IllegalArgumentException(
                    "'" + canonical + "' is a built-in tag and can't be deleted. Switch it off with the "
                    + "Active toggle instead.");
        }

        long affected = recordTagRepository.countByTagType(canonical);
        recordTagRepository.deleteByTagType(canonical);
        repository.deleteById(canonical);
        log.info("Tag deleted; tagType={}, recordTagRowsRemoved={}", canonical, affected);
        return affected;
    }

    // ── Update ───────────────────────────────────────────────────────────────

    @Transactional
    public TagDefinitionEntity update(String tagType, String displayName, String description,
                                      boolean active, String defaultSort, String defaultDirection,
                                      TagRule rule) {
        TagDefinitionEntity entity = repository.findById(tagType)
                .orElseGet(() -> Optional.ofNullable(DEFAULTS.get(tagType))
                        .orElse(buildFallback(tagType)));

        entity.setDisplayName(displayName);
        entity.setDescription(description);
        entity.setActive(active);
        entity.setDefaultSort(defaultSort);
        entity.setDefaultDirection(defaultDirection);

        // A built-in's membership is owned by its strategy, so a rule on it would be dead config —
        // refuse it rather than storing something that never runs (see TagStrategyExecutor).
        boolean builtInStrategy = strategyOwned().contains(entity.getTagType());
        if (!builtInStrategy) {
            entity.setRule((rule == null || rule.isEmpty()) ? null : rule);
        } else if (rule != null && !rule.isEmpty()) {
            throw new IllegalArgumentException(
                    "'" + entity.getTagType() + "' is computed by built-in code, so a rule would never "
                    + "run. Create a new tag with this rule instead.");
        }
        entity.setAutomatic(isAutomatic(entity));
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
                .build();
    }
}
