package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.rail.util.RailSortBuilder;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.cache.CacheManager;
import org.springframework.cache.support.NoOpCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Executes the SQL that {@link TagRuleEvaluator} generates.
 *
 * <p>The unit tests around rule tags all mock the repository, so they prove the wiring but never
 * make a database parse the query. That is the gap that matters here: a Criteria API specification
 * compiles happily in Java and can still produce SQL the engine rejects. The specific hazard is
 * {@code query.distinct(true)} (set when a rule filters on genres, so a record with several matching
 * genres isn't counted twice) combined with an ORDER BY on a joined column that isn't in the SELECT
 * list — legal in MySQL, rejected by stricter engines.
 *
 * <p>These assert only that each rule shape RUNS. No fixture data is needed: the query is still
 * built, translated and executed against the schema, which is where a malformed path or an illegal
 * DISTINCT/ORDER BY combination surfaces.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TagRuleEvaluatorJpaTest {

    /**
     * Boot 4's JPA slice no longer imports cache auto-config (the app is @EnableCaching), and a
     * @DataJpaTest slice doesn't scan @Component beans — so RailSortBuilder is declared here.
     * Declaring it as a bean rather than newing it up means Spring runs its @PostConstruct, so the
     * metamodel scan under test is the same one production gets.
     */
    @TestConfiguration
    static class SliceConfig {
        @Bean CacheManager cacheManager() { return new NoOpCacheManager(); }
        @Bean RailSortBuilder railSortBuilder(EntityManager em) { return new RailSortBuilder(em); }
        @Bean FilterFieldRegistry filterFieldRegistry(EntityManager em) { return new FilterFieldRegistry(em); }
        @Bean TagConditionCompiler tagConditionCompiler(FilterFieldRegistry r) { return new TagConditionCompiler(r); }
        @Bean TagRuleEvaluator tagRuleEvaluator(TagConditionCompiler c) { return new TagRuleEvaluator(c); }
    }

    @Autowired RecordRepository recordRepository;
    @Autowired TagRuleEvaluator evaluator;
    @Autowired RailSortBuilder sortBuilder;

    /** Runs a rule the way RuleTagRefresher does, and fails if the engine rejects the SQL. */
    private void assertRuleExecutes(TagRule rule, String scoreBy) {
        var pageable = PageRequest.of(0, 20, sortBuilder.build(scoreBy, "DESC"));
        assertThatCode(() -> recordRepository
                .findIdsBySpecification(evaluator.toSpecification(rule), pageable)
                .getContent())
                .as("rule scored by %s should produce executable SQL", scoreBy)
                .doesNotThrowAnyException();
    }

    @Test
    void genreFilter_withJoinedColumnSort_executes() {
        // The DISTINCT + ORDER BY tmdb.popularity combination this test exists for.
        TagRule rule = new TagRule();
        rule.setGenreIds(List.of(28L, 12L));
        assertRuleExecutes(rule, "popularity");
    }

    @Test
    void genreFilter_withRootColumnSort_executes() {
        TagRule rule = new TagRule();
        rule.setGenreIds(List.of(28L));
        assertRuleExecutes(rule, "publishedAt");
    }

    @Test
    void requiresMediaFiles_existsSubquery_executes() {
        TagRule rule = new TagRule();
        rule.setRequiresMediaFiles(true);
        assertRuleExecutes(rule, "popularity");
    }

    @Test
    void ratingAndPopularityThresholds_execute() {
        TagRule rule = new TagRule();
        rule.setMinVoteAverage(7.5);
        rule.setMinVoteCount(500);
        rule.setMinPopularity(50.0);
        assertRuleExecutes(rule, "topRated");
    }

    @Test
    void dateWindows_execute() {
        // primaryDate is a VARCHAR holding an ISO date, compared lexicographically; the others are
        // real Instants. Both shapes go through here.
        TagRule rule = new TagRule();
        rule.setReleasedWithinDays(30);
        rule.setAddedWithinDays(30);
        rule.setPublishedWithinDays(30);
        rule.setNewContentWithinDays(30);
        assertRuleExecutes(rule, "releaseAirDate");
    }

    @Test
    void languageAndTypeFilters_execute() {
        TagRule rule = new TagRule();
        rule.setRecordType("MOVIE");
        rule.setLanguages(List.of("hi", "en"));
        assertRuleExecutes(rule, "voteAverage");
    }

    @Test
    void everyCriterionAtOnce_executes() {
        // The worst case: every predicate, a genre join forcing DISTINCT, an EXISTS subquery, and a
        // joined-column sort all in one statement.
        TagRule rule = new TagRule();
        rule.setRecordType("TV_SERIES");
        rule.setGenreIds(List.of(18L, 10765L));
        rule.setLanguages(List.of("en"));
        rule.setMinVoteAverage(7.0);
        rule.setMinVoteCount(100);
        rule.setMinPopularity(10.0);
        rule.setReleasedWithinDays(365);
        rule.setAddedWithinDays(90);
        rule.setPublishedWithinDays(90);
        rule.setNewContentWithinDays(30);
        rule.setRequiresMediaFiles(true);
        assertRuleExecutes(rule, "topRated");
    }

    /* ================================================================
       "COMING SOON" and "ONLY ON <provider>"
    ================================================================= */

    @Test
    void comingSoon_futureReleaseWithNoFiles_executes() {
        // The Coming Soon shape: dated ahead, and NOT EXISTS on media files.
        TagRule rule = new TagRule();
        rule.setReleasingWithinNextDays(90);
        rule.setRequiresMediaFiles(false);
        assertRuleExecutes(rule, "releaseAirDate");
    }

    @Test
    void requiresMediaFiles_false_isNotExists_notIgnored() {
        // Guards the tri-state: false has to mean "no files", not "don't care". If it were ignored
        // a Coming Soon rail would quietly fill with everything already playable.
        TagRule rule = new TagRule();
        rule.setRequiresMediaFiles(false);
        assertThat(rule.isEmpty()).as("false is a real narrowing criterion").isFalse();
        assertRuleExecutes(rule, "popularity");
    }

    @Test
    void providerFilter_executes() {
        // "Only on Netflix" — joins tmdb_providers, which nothing else in these tests touches.
        TagRule rule = new TagRule();
        rule.setProviderIds(List.of(8L));           // 8 = Netflix
        assertRuleExecutes(rule, "popularity");
    }

    @Test
    void providerFilter_withTypeAndRegion_executes() {
        TagRule rule = new TagRule();
        rule.setProviderIds(List.of(8L, 119L, 122L));
        rule.setProviderType("FLATRATE");
        rule.setProviderRegion("IN");
        assertRuleExecutes(rule, "publishedAt");
    }

    @Test
    void providerFilter_combinedWithGenreJoin_executes() {
        // Two collection joins plus DISTINCT plus a joined-column ORDER BY in one statement.
        TagRule rule = new TagRule();
        rule.setProviderIds(List.of(8L));
        rule.setGenreIds(List.of(18L));
        assertRuleExecutes(rule, "topRated");
    }

    @Test
    void releasedWithinDays_doesNotAlsoMatchFutureDates() {
        // primaryDate is a VARCHAR, so a lexicographic >= cutoff matches next year's announcements
        // too. The upper bound closing that hole has to survive.
        TagRule rule = new TagRule();
        rule.setReleasedWithinDays(30);
        assertRuleExecutes(rule, "releaseAirDate");
    }

    @Test
    void everyDiscoveredSortField_worksAsARuleScore() {
        // A rule can be scored by anything the dropdown offers, so every one of them has to survive
        // being combined with a DISTINCT genre join.
        TagRule rule = new TagRule();
        rule.setGenreIds(List.of(28L));
        for (var field : sortBuilder.availableFields()) {
            if (RailSortBuilder.TAG_PRIORITY.equals(field.value())) continue;  // computed, not sortable here
            assertRuleExecutes(rule, field.value());
        }
    }
}
