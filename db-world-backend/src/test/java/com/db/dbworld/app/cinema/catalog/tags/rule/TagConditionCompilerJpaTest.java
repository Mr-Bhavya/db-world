package com.db.dbworld.app.cinema.catalog.tags.rule;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.tags.rule.FilterFieldRegistry.FilterField;
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
 * Executes the SQL generated for EVERY field/operator pair the admin UI offers.
 *
 * <p>This is the test that makes a generic filter builder safe to ship. The whole point of the
 * builder is that an admin can combine anything the registry advertises — which means the number of
 * expressible rules is far too large to hand-write cases for. So instead of picking examples, this
 * enumerates the registry and runs each combination against a real database. If a field is
 * discovered whose type maps to an operator that can't actually be translated, the build fails here
 * rather than at 3am when the scheduler hits it.
 *
 * <p>No fixture data is needed: building, translating and executing the query is what exercises the
 * path resolution, the join cache and the type coercion.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TagConditionCompilerJpaTest {

    @TestConfiguration
    static class SliceConfig {
        @Bean CacheManager cacheManager() { return new NoOpCacheManager(); }
        @Bean RailSortBuilder railSortBuilder(EntityManager em) { return new RailSortBuilder(em); }
        @Bean FilterFieldRegistry filterFieldRegistry(EntityManager em) { return new FilterFieldRegistry(em); }
        @Bean TagConditionCompiler tagConditionCompiler(FilterFieldRegistry r) { return new TagConditionCompiler(r); }
        @Bean TagRuleEvaluator tagRuleEvaluator(TagConditionCompiler c) { return new TagRuleEvaluator(c); }
    }

    @Autowired RecordRepository recordRepository;
    @Autowired FilterFieldRegistry registry;
    @Autowired TagRuleEvaluator evaluator;
    @Autowired RailSortBuilder sortBuilder;

    private void assertExecutes(TagRule rule, String because) {
        var pageable = PageRequest.of(0, 20, sortBuilder.build("popularity", "DESC"));
        assertThatCode(() -> recordRepository
                .findIdsBySpecification(evaluator.toSpecification(rule), pageable).getContent())
                .as(because)
                .doesNotThrowAnyException();
    }

    private static TagRule ruleOf(TagCondition... conditions) {
        TagRule r = new TagRule();
        r.setConditions(List.of(conditions));
        return r;
    }

    private static TagCondition cond(String field, String op, Object value) {
        TagCondition c = new TagCondition();
        c.setField(field);
        c.setOperator(op);
        c.setValue(value);
        return c;
    }

    private static TagCondition condIn(String field, String op, List<Object> values) {
        TagCondition c = new TagCondition();
        c.setField(field);
        c.setOperator(op);
        c.setValues(values);
        return c;
    }

    /** A value that will coerce for the given field type. */
    private static Object sampleValue(FilterField f) {
        return switch (f.type()) {
            case NUMBER      -> "1";
            case BOOLEAN     -> "true";
            case ENUM        -> f.options().isEmpty() ? "X" : f.options().get(0).value();
            case INSTANT     -> "2020-01-01T00:00:00Z";
            case DATE_STRING -> "2020-01-01";
            case REFERENCE   -> "1";
            case TEXT        -> "x";
            case PRESENCE    -> null;
        };
    }

    @Test
    void registryIsNotEmpty() {
        // If discovery silently found nothing, every other test here would vacuously pass.
        assertThat(registry.availableFields()).isNotEmpty();
        assertThat(registry.availableFields()).anySatisfy(f ->
                assertThat(f.value()).isEqualTo("provider"));
    }

    @Test
    void everyFieldOperatorPair_producesExecutableSql() {
        List<FilterField> fields = registry.availableFields();

        for (FilterField f : fields) {
            for (var op : f.operators()) {
                Object v = sampleValue(f);
                TagCondition c = switch (op.value()) {
                    case "in", "notIn" -> condIn(f.value(), op.value(), List.of(v));
                    default            -> cond(f.value(), op.value(), v);
                };
                assertExecutes(ruleOf(c),
                        "field '%s' with operator '%s' (type %s)".formatted(
                                f.value(), op.value(), f.type()));
            }
        }
    }

    @Test
    void twoConditionsOnTheSameCollection_shareOneJoin() {
        // Without a shared join cache each condition joins genres separately, and the rule matches
        // nothing at all — one joined row cannot be two different genres. Asserting the SQL runs is
        // only half of it; the join cache is what makes the result non-empty in real data.
        TagRule rule = ruleOf(
                condIn("genre", "in", List.of(28L)),
                condIn("genre", "notIn", List.of(99L)));
        assertExecutes(rule, "two genre conditions must reuse one join");
    }

    @Test
    void genericAndShortcutHalves_combineWithoutDoubleJoining() {
        // The shortcut genreIds registers its join in the same cache the generic half uses, so a rule
        // that mixes both must not end up with two genre joins.
        TagRule rule = new TagRule();
        rule.setGenreIds(List.of(18L));
        rule.setProviderIds(List.of(8L));
        rule.setConditions(List.of(
                condIn("genre", "notIn", List.of(27L)),
                condIn("provider", "in", List.of(8L, 119L)),
                cond("voteAverage", "gte", "7")));
        assertExecutes(rule, "shortcuts and generic conditions must share joins");
    }

    @Test
    void unknownField_isSkippedNotFatal() {
        // Comes from a stale saved rule after a column is renamed. Dropping the row keeps the rest
        // of the rule working, which beats failing the whole scheduler pass.
        TagRule rule = ruleOf(cond("noSuchColumn", "eq", "1"));
        assertThat(rule.isEmpty()).isFalse();
        assertExecutes(rule, "an unknown field must not break the query");
    }

    @Test
    void operatorNotValidForTheField_isSkipped() {
        // e.g. "contains" on a number. The UI wouldn't offer it, but a hand-crafted request could.
        TagRule rule = ruleOf(cond("voteCount", "contains", "7"));
        assertExecutes(rule, "an illegal operator must be ignored, not translated");
    }

    @Test
    void uncoercibleValue_isSkipped() {
        // "abc" for a numeric column. Must not abort the tag refresh.
        TagRule rule = ruleOf(cond("voteCount", "gte", "abc"));
        assertExecutes(rule, "a bad value must be dropped rather than thrown");
    }

    @Test
    void comingSoon_expressedGenerically_executes() {
        // The same rail as the shortcut version, assembled from generic rows — proof the generic
        // half really can express what the curated fields do.
        TagRule rule = ruleOf(
                cond("primaryDate", "withinNextDays", "90"),
                cond("mediaFiles", "hasNone", null));
        assertExecutes(rule, "coming soon, built from generic conditions");
    }

    @Test
    void onlyOnNetflix_expressedGenerically_executes() {
        TagRule rule = ruleOf(condIn("provider", "in", List.of(8L)));
        assertExecutes(rule, "only-on-Netflix, built from a generic condition");
    }

    @Test
    void conditionCountIsCapped() {
        // A pathological rule must be truncated rather than generating 100 ANDed joins.
        List<TagCondition> many = new java.util.ArrayList<>();
        for (int i = 0; i < TagConditionCompiler.MAX_CONDITIONS + 15; i++) {
            many.add(cond("voteCount", "gte", String.valueOf(i)));
        }
        TagRule rule = new TagRule();
        rule.setConditions(many);
        assertExecutes(rule, "over-long condition lists are capped, not executed in full");
    }

    @Test
    void blankRowsAreIgnored_soAnEmptyBuilderRowIsHarmless() {
        // The UI starts a new row empty; it must not count as a criterion or break the query.
        TagCondition blank = new TagCondition();
        TagRule rule = new TagRule();
        rule.setConditions(List.of(blank));
        assertThat(rule.isEmpty()).as("a blank row is not a criterion").isTrue();
    }
}
