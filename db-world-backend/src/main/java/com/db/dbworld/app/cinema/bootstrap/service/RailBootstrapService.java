package com.db.dbworld.app.cinema.bootstrap.service;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.repository.RailRepository;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class RailBootstrapService {

    private final RailRepository railRepository;

    private int created;
    private int updated;

    public void generateRails() {
        long start = System.currentTimeMillis();
        created = 0;
        updated = 0;
        log.info("Rail bootstrap started");

        try {
            createHomeRails();
            createMovieRails();
            createSeriesRails();
            log.info("Rail bootstrap completed; created={}, updated={}, took={}ms",
                    created, updated, System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("Rail bootstrap failed; created={}, updated={}, took={}ms",
                    created, updated, System.currentTimeMillis() - start, e);
            throw e;
        }
    }

    /* ================================================================
       HOME PAGE RAILS  (mixed movies + series)
    ================================================================= */

    private void createHomeRails() {

        // ── Curated / auto-scored rails ──────────────────────────────
        // No explicit sort: falls back to TagDefinition.defaultSort = tagPriority DESC,
        // which uses the time-decay scores stored by TagStrategyExecutor.
        upsertRail("Trending Now",
                ruleTagAuto("TRENDING"),
                PageType.HOME, 1, false, 20);

        upsertRail("Top 10 Today",
                ruleTagAuto("TOP_10"),
                PageType.HOME, 2, false, 10);

        // Surfaces shows that gained a new season/episode in the last 30 days, even if
        // the show itself is old / low-trending. Union of NEW_SEASON + NEW_EPISODE.
        upsertRail("New Episodes & Seasons",
                ruleTagsAuto(List.of("NEW_SEASON", "NEW_EPISODE")),
                PageType.HOME, 3, true, 20);

        upsertRail("Recently Added",
                ruleTagAuto("RECENTLY_ADDED"),
                PageType.HOME, 4, true, 20);

        upsertRail("Featured",
                ruleTagAuto("FEATURED"),
                PageType.HOME, 5, false, 20);

        upsertRail("Editor's Picks",
                ruleTagAuto("EDITOR_PICK"),
                PageType.HOME, 6, false, 20);

        upsertRail("Available for Download",
                ruleTagAuto("AVAILABLE_FOR_DOWNLOAD"),
                PageType.HOME, 7, true, 20);

        // ── Genre rails ──────────────────────────────────────────────
        upsertRail("Action & Adventure",
                ruleGenre(28L, "popularity", "DESC"),
                PageType.HOME, 10, true, 20);

        upsertRail("Comedy",
                ruleGenre(35L, "popularity", "DESC"),
                PageType.HOME, 11, true, 20);

        upsertRail("Drama",
                ruleGenre(18L, "popularity", "DESC"),
                PageType.HOME, 12, true, 20);

        upsertRail("Horror",
                ruleGenre(27L, "popularity", "DESC"),
                PageType.HOME, 13, true, 20);

        upsertRail("Romance",
                ruleGenre(10749L, "popularity", "DESC"),
                PageType.HOME, 14, true, 20);

        upsertRail("Sci-Fi & Fantasy",
                ruleGenre(878L, "popularity", "DESC"),
                PageType.HOME, 15, true, 20);

        upsertRail("Thriller",
                ruleGenre(53L, "popularity", "DESC"),
                PageType.HOME, 16, true, 20);

        upsertRail("Animation",
                ruleGenre(16L, "popularity", "DESC"),
                PageType.HOME, 17, true, 20);

        // ── Language rails ───────────────────────────────────────────
        upsertRail("Hollywood Hits",
                ruleLanguage(List.of("en"), "popularity", "DESC"),
                PageType.HOME, 30, true, 20);

        upsertRail("Bollywood Blockbusters",
                ruleLanguage(List.of("hi"), "popularity", "DESC"),
                PageType.HOME, 31, true, 20);

        upsertRail("South Indian Cinema",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC"),
                PageType.HOME, 32, true, 20);

        upsertRail("Korean Wave",
                ruleLanguage(List.of("ko"), "popularity", "DESC"),
                PageType.HOME, 33, true, 20);

        // ── Filter rails ─────────────────────────────────────────────
        upsertRail("Critically Acclaimed",
                ruleFilter("voteAverage", 8.0, null, "voteAverage", "DESC"),
                PageType.HOME, 40, true, 20);

        upsertRail("Most Popular",
                ruleFilter(null, null, null, "popularity", "DESC"),
                PageType.HOME, 41, true, 20);
    }

    /* ================================================================
       MOVIES PAGE RAILS
    ================================================================= */

    private void createMovieRails() {

        // ── Curated / auto-scored rails ──────────────────────────────
        upsertRail("Trending Movies",
                ruleTagAuto("TRENDING", "MOVIE"),
                PageType.MOVIES, 1, false, 20);

        upsertRail("Top 10 Movies Today",
                ruleTagAuto("TOP_10", "MOVIE"),
                PageType.MOVIES, 2, false, 10);

        upsertRail("Recently Added Movies",
                ruleTagAuto("RECENTLY_ADDED", "MOVIE"),
                PageType.MOVIES, 3, true, 20);

        upsertRail("Featured Movies",
                ruleTagAuto("FEATURED", "MOVIE"),
                PageType.MOVIES, 4, false, 20);

        upsertRail("Editor's Pick Movies",
                ruleTagAuto("EDITOR_PICK", "MOVIE"),
                PageType.MOVIES, 5, false, 20);

        upsertRail("Movies Available for Download",
                ruleTagAuto("AVAILABLE_FOR_DOWNLOAD", "MOVIE"),
                PageType.MOVIES, 6, true, 20);

        // ── Genre rails ──────────────────────────────────────────────
        upsertRail("Action Movies",
                ruleGenre(28L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 10, true, 20);

        upsertRail("Comedy Movies",
                ruleGenre(35L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 11, true, 20);

        upsertRail("Drama Movies",
                ruleGenre(18L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 12, true, 20);

        upsertRail("Horror Movies",
                ruleGenre(27L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 13, true, 20);

        upsertRail("Romance Movies",
                ruleGenre(10749L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 14, true, 20);

        upsertRail("Sci-Fi Movies",
                ruleGenre(878L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 15, true, 20);

        upsertRail("Thriller Movies",
                ruleGenre(53L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 16, true, 20);

        upsertRail("Animated Movies",
                ruleGenre(16L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 17, true, 20);

        upsertRail("Documentary Movies",
                ruleGenre(99L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 18, true, 20);

        upsertRail("Mystery Movies",
                ruleGenre(9648L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 19, true, 20);

        // ── Language rails ───────────────────────────────────────────
        upsertRail("Hollywood Movies",
                ruleLanguage(List.of("en"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 30, true, 20);

        upsertRail("Bollywood Movies",
                ruleLanguage(List.of("hi"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 31, true, 20);

        upsertRail("South Indian Movies",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 32, true, 20);

        upsertRail("Korean Movies",
                ruleLanguage(List.of("ko"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 33, true, 20);

        // ── Filter rails ─────────────────────────────────────────────
        upsertRail("Highest Rated Movies",
                ruleFilter("voteAverage", 8.0, "MOVIE", "voteAverage", "DESC"),
                PageType.MOVIES, 40, true, 20);

        upsertRail("Most Popular Movies",
                ruleFilter(null, null, "MOVIE", "popularity", "DESC"),
                PageType.MOVIES, 41, true, 20);
    }

    /* ================================================================
       SERIES PAGE RAILS
    ================================================================= */

    private void createSeriesRails() {

        // ── Curated / auto-scored rails ──────────────────────────────
        upsertRail("Trending TV Shows",
                ruleTagAuto("TRENDING", "TV_SERIES"),
                PageType.SERIES, 1, false, 20);

        upsertRail("Top 10 TV Shows Today",
                ruleTagAuto("TOP_10", "TV_SERIES"),
                PageType.SERIES, 2, false, 10);

        upsertRail("Recently Added TV Shows",
                ruleTagAuto("RECENTLY_ADDED", "TV_SERIES"),
                PageType.SERIES, 3, true, 20);

        upsertRail("Featured TV Shows",
                ruleTagAuto("FEATURED", "TV_SERIES"),
                PageType.SERIES, 4, false, 20);

        upsertRail("Editor's Pick TV Shows",
                ruleTagAuto("EDITOR_PICK", "TV_SERIES"),
                PageType.SERIES, 5, false, 20);

        upsertRail("TV Shows Available for Download",
                ruleTagAuto("AVAILABLE_FOR_DOWNLOAD", "TV_SERIES"),
                PageType.SERIES, 6, true, 20);

        // ── Genre rails (TMDB TV genre IDs) ─────────────────────────
        upsertRail("Action & Adventure Series",
                ruleGenre(10759L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 10, true, 20);

        upsertRail("Comedy Series",
                ruleGenre(35L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 11, true, 20);

        upsertRail("Drama Series",
                ruleGenre(18L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 12, true, 20);

        upsertRail("Crime Series",
                ruleGenre(80L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 13, true, 20);

        upsertRail("Sci-Fi & Fantasy Series",
                ruleGenre(10765L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 14, true, 20);

        upsertRail("Mystery Series",
                ruleGenre(9648L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 15, true, 20);

        upsertRail("Animated Series",
                ruleGenre(16L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 16, true, 20);

        upsertRail("Documentary Series",
                ruleGenre(99L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 17, true, 20);

        upsertRail("Reality TV",
                ruleGenre(10764L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 18, true, 20);

        upsertRail("K-Drama",
                ruleLanguage(List.of("ko"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 19, true, 20);

        // ── Language rails ───────────────────────────────────────────
        upsertRail("English TV Shows",
                ruleLanguage(List.of("en"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 30, true, 20);

        upsertRail("Hindi TV Shows",
                ruleLanguage(List.of("hi"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 31, true, 20);

        upsertRail("South Indian TV Shows",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 32, true, 20);

        // ── Filter rails ─────────────────────────────────────────────
        upsertRail("Highest Rated TV Shows",
                ruleFilter("voteAverage", 8.0, "TV_SERIES", "voteAverage", "DESC"),
                PageType.SERIES, 40, true, 20);

        upsertRail("Most Popular TV Shows",
                ruleFilter(null, null, "TV_SERIES", "popularity", "DESC"),
                PageType.SERIES, 41, true, 20);
    }

    /* ================================
       RULE BUILDERS
    ================================= */

    /**
     * Tag rail with no explicit sort — the RailResolver will inherit
     * TagDefinition.defaultSort (tagPriority DESC for auto-computed tags,
     * createdAt DESC for RECENTLY_ADDED).  This ensures time-decay scores
     * computed by TagStrategyExecutor actually drive the display order.
     */
    private RailRule ruleTagAuto(String tag) {
        return ruleTagAuto(tag, null);
    }

    private RailRule ruleTagAuto(String tag, String recordType) {
        RailRule rule = new RailRule();
        rule.setType("tag");
        rule.setTag(tag);
        rule.setSort(null);
        rule.setDirection(null);
        rule.setRecordType(recordType);
        return rule;
    }

    /** Tag rail spanning multiple tag types (union) — e.g. NEW_SEASON + NEW_EPISODE. */
    private RailRule ruleTagsAuto(List<String> tags) {
        RailRule rule = new RailRule();
        rule.setType("tag");
        rule.setTags(tags);
        rule.setSort(null);
        rule.setDirection(null);
        return rule;
    }

    private RailRule ruleGenre(Long genreId, String sort, String direction) {
        return ruleGenre(genreId, sort, direction, null);
    }

    private RailRule ruleGenre(Long genreId, String sort, String direction, String recordType) {
        RailRule rule = new RailRule();
        rule.setType("genre");
        rule.setGenreId(genreId);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);
        return rule;
    }

    private RailRule ruleLanguage(List<String> languages, String sort, String direction) {
        return ruleLanguage(languages, sort, direction, null);
    }

    private RailRule ruleLanguage(List<String> languages, String sort, String direction, String recordType) {
        RailRule rule = new RailRule();
        rule.setType("language");
        rule.setLanguages(languages);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);
        return rule;
    }

    private RailRule ruleFilter(String field, Object value, String recordType, String sort, String direction) {
        RailRule rule = new RailRule();
        rule.setType("filter");
        rule.setField(field);
        rule.setValue(value);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);
        return rule;
    }

    /* ================================
       UPSERT RAIL
    ================================= */

    /**
     * Creates the rail if it doesn't exist yet.
     * If it does exist, updates the rule's {@code sort}, {@code direction}, and
     * {@code tag} fields so stale configs from previous bootstrap runs are corrected
     * (e.g. wrong sort fields, retired tag names like NEW_RELEASE/SHOW_ON_TOP).
     * Structural properties (priority, limit, pageType) are NOT changed on existing
     * rails so admin adjustments survive application restarts.
     */
    private void upsertRail(String title, RailRule rule, PageType pageType,
                            int priority, boolean infiniteScroll, int limit) {

        Optional<RailEntity> existingOpt = railRepository.findByTitle(title);

        if (existingOpt.isPresent()) {
            RailEntity existing = existingOpt.get();
            RailRule existingRule = existing.getRule();
            if (existingRule != null) {
                existingRule.setSort(rule.getSort());
                existingRule.setDirection(rule.getDirection());
                if (rule.getTag() != null) {
                    existingRule.setTag(rule.getTag());
                }
                if (rule.getTags() != null) {
                    existingRule.setTags(rule.getTags());
                }
            }
            railRepository.save(existing);
            updated++;
            return;
        }

        railRepository.save(
                RailEntity.builder()
                        .title(title)
                        .rule(rule)
                        .pageTypes(java.util.EnumSet.of(pageType))
                        .priority(priority)
                        .limitSize(limit)
                        .active(true)
                        .infiniteScroll(infiniteScroll)
                        .build()
        );
        created++;
    }
}
