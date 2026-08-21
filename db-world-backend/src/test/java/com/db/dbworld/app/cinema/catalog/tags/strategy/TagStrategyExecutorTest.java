package com.db.dbworld.app.cinema.catalog.tags.strategy;

import com.db.dbworld.app.cinema.catalog.tags.entity.TagDefinitionEntity;
import com.db.dbworld.app.cinema.catalog.tags.rule.RuleTagRefresher;
import com.db.dbworld.app.cinema.catalog.tags.rule.TagRule;
import com.db.dbworld.app.cinema.catalog.tags.services.TagDefinitionService;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The {@code active} flag on a TagDefinition. It used to be write-only — the admin UI persisted it
 * and the executor ignored it, so turning a tag off did nothing. These pin the wiring down.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagStrategyExecutorTest {

    @Mock EntityManager entityManager;
    @Mock TagDefinitionService tagDefinitionService;
    @Mock RuleTagRefresher ruleTagRefresher;
    @Mock ApplicationEventPublisher publisher;
    @Mock Query query;

    /** Minimal stub strategy — the SQL is never executed, only handed to the EntityManager. */
    private record StubStrategy(RecordTagType type) implements TagStrategy {
        @Override public RecordTagType tagType() { return type; }
        @Override public String selectSql()      { return "SELECT r.id, 1 AS score FROM records r"; }
    }

    private static TagDefinitionEntity def(String tagType, boolean active) {
        return TagDefinitionEntity.builder()
                .tagType(tagType).displayName(tagType)
                .automatic(true).active(active)
                .defaultSort("tagPriority").defaultDirection("DESC")
                .build();
    }

    @BeforeEach
    void setUp() {
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.executeUpdate()).thenReturn(1);
        // The rule-tag pass reads every definition; these tests are about code strategies only.
        when(tagDefinitionService.findAll()).thenReturn(List.of());
    }

    private TagStrategyExecutor executorFor(List<TagStrategy> strategies) {
        return new TagStrategyExecutor(strategies, tagDefinitionService, ruleTagRefresher, publisher, entityManager);
    }

    @Test
    void executeAll_inactiveTag_isSkippedEntirely() {
        when(tagDefinitionService.getOrDefault("TRENDING")).thenReturn(def("TRENDING", false));

        executorFor(List.of(new StubStrategy(RecordTagType.TRENDING))).executeAll();

        // No DELETE, no INSERT, and no refresh stamp — the tag's existing rows survive untouched
        // so rails pointing at it freeze rather than going empty.
        verify(entityManager, never()).createNativeQuery(anyString());
        verify(tagDefinitionService, never()).markRefreshed(anyString());
    }

    @Test
    void executeAll_activeTag_runsAndStampsRefresh() {
        when(tagDefinitionService.getOrDefault("TRENDING")).thenReturn(def("TRENDING", true));

        executorFor(List.of(new StubStrategy(RecordTagType.TRENDING))).executeAll();

        verify(entityManager).createNativeQuery(contains("DELETE FROM record_tags"));
        verify(entityManager).createNativeQuery(contains("INSERT INTO record_tags"));
        verify(tagDefinitionService).markRefreshed("TRENDING");
    }

    @Test
    void executeAll_oneInactiveAmongMany_doesNotBlockTheOthers() {
        when(tagDefinitionService.getOrDefault("TRENDING")).thenReturn(def("TRENDING", false));
        when(tagDefinitionService.getOrDefault("FEATURED")).thenReturn(def("FEATURED", true));

        executorFor(List.of(
                new StubStrategy(RecordTagType.TRENDING),
                new StubStrategy(RecordTagType.FEATURED)
        )).executeAll();

        verify(tagDefinitionService, never()).markRefreshed("TRENDING");
        verify(tagDefinitionService).markRefreshed("FEATURED");
    }

    @Test
    void execute_explicitRecalculate_ignoresTheActiveFlag() {
        // The admin "Recalculate" button is an explicit action — `active` governs the scheduler,
        // so a deliberate click must still work on a deactivated tag.
        when(tagDefinitionService.getOrDefault("TRENDING")).thenReturn(def("TRENDING", false));

        executorFor(List.of(new StubStrategy(RecordTagType.TRENDING)))
                .execute("TRENDING");

        verify(tagDefinitionService).markRefreshed(eq("TRENDING"));
    }

    @Test
    void execute_manualTagWithNoStrategy_isANoOpRatherThanAnError() {
        // Admin-created tags have no strategy. Asking to recalculate one must not blow up — there is
        // simply nothing to recompute, because its records are curated by hand.
        when(tagDefinitionService.getOrDefault("DIWALI_SPECIAL"))
                .thenReturn(def("DIWALI_SPECIAL", true));   // manual: no rule

        executorFor(List.of(new StubStrategy(RecordTagType.TRENDING)))
                .execute("DIWALI_SPECIAL");

        verify(entityManager, never()).createNativeQuery(anyString());
        verify(ruleTagRefresher, never()).refresh(any());
        verify(tagDefinitionService, never()).markRefreshed(anyString());
    }

    /* ================================================================
       ADMIN-DEFINED RULE TAGS
    ================================================================= */

    private static TagDefinitionEntity ruleDef(String tagType, boolean active) {
        TagRule rule = new TagRule();
        rule.setMinVoteAverage(8.0);
        return TagDefinitionEntity.builder()
                .tagType(tagType).displayName(tagType)
                .automatic(true).active(active)
                .defaultSort("tagPriority").defaultDirection("DESC")
                .rule(rule)
                .build();
    }

    @Test
    void executeAll_ruleTag_isRefreshedAndStamped() {
        TagDefinitionEntity rd = ruleDef("CRITIC_FAVOURITES", true);
        when(tagDefinitionService.findAll()).thenReturn(List.of(rd));

        executorFor(List.of()).executeAll();

        verify(ruleTagRefresher).refresh(rd);
        verify(tagDefinitionService).markRefreshed("CRITIC_FAVOURITES");
    }

    @Test
    void executeAll_inactiveRuleTag_isSkipped() {
        when(tagDefinitionService.findAll()).thenReturn(List.of(ruleDef("CRITIC_FAVOURITES", false)));

        executorFor(List.of()).executeAll();

        verify(ruleTagRefresher, never()).refresh(any());
        verify(tagDefinitionService, never()).markRefreshed(anyString());
    }

    @Test
    void executeAll_tagWithNoRule_isLeftAlone() {
        // A purely manual tag must never be touched by the rule pass.
        when(tagDefinitionService.findAll()).thenReturn(List.of(def("EDITOR_PICK", true)));

        executorFor(List.of()).executeAll();

        verify(ruleTagRefresher, never()).refresh(any());
    }

    @Test
    void executeAll_strategyOwnedTagWithARule_lettsTheStrategyWin() {
        // Defence in depth: the definition service refuses to store a rule on a built-in, but if one
        // ever existed the strategy must remain authoritative rather than both writing the same tag.
        when(tagDefinitionService.getOrDefault("TRENDING")).thenReturn(def("TRENDING", true));
        when(tagDefinitionService.findAll()).thenReturn(List.of(ruleDef("TRENDING", true)));

        executorFor(List.of(new StubStrategy(RecordTagType.TRENDING))).executeAll();

        verify(entityManager).createNativeQuery(contains("INSERT INTO record_tags"));
        verify(ruleTagRefresher, never()).refresh(any());
    }

    @Test
    void executeAll_oneBrokenRule_doesNotStopTheOthers() {
        // An admin-authored rule is untrusted input; one bad one must not abort the whole refresh.
        TagDefinitionEntity bad  = ruleDef("BAD_RULE", true);
        TagDefinitionEntity good = ruleDef("GOOD_RULE", true);
        when(tagDefinitionService.findAll()).thenReturn(List.of(bad, good));
        when(ruleTagRefresher.refresh(bad)).thenThrow(new IllegalStateException("boom"));

        executorFor(List.of()).executeAll();

        verify(ruleTagRefresher).refresh(good);
        verify(tagDefinitionService).markRefreshed("GOOD_RULE");
        verify(tagDefinitionService, never()).markRefreshed("BAD_RULE");
    }

    @Test
    void execute_singleRuleTag_refreshesIt() {
        TagDefinitionEntity rd = ruleDef("CRITIC_FAVOURITES", true);
        when(tagDefinitionService.getOrDefault("CRITIC_FAVOURITES")).thenReturn(rd);

        executorFor(List.of()).execute("CRITIC_FAVOURITES");

        verify(ruleTagRefresher).refresh(rd);
        verify(tagDefinitionService).markRefreshed("CRITIC_FAVOURITES");
    }
}
