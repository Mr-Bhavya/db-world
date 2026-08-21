package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Both bulk methods logged {@code recordIds != null ? ... : 0}, acknowledging a null
 * list, then immediately iterated it — so a null argument threw NPE rather than being
 * the no-op the log implied.
 *
 * <p>Updated when tag types moved from the {@code RecordTagType} enum to free-form Strings (so
 * admins can create their own tags). Two knock-on changes to be aware of:
 * <ul>
 *   <li>the tag name is now validated FIRST, so these use a manual tag that exists — the null check
 *       sits after {@code requireManual}, and an unknown or automatic tag is rejected before it;</li>
 *   <li>a no-op must publish no cache-eviction event either, since there is nothing to evict.</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagAdminServiceTest {

    private static final String MANUAL_TAG = "DIWALI_SPECIAL";

    @Mock RecordTagRepository       tagRepository;
    @Mock RecordRepository          recordRepository;
    @Mock RecordTagMapper           tagMapper;
    @Mock TagStrategyExecutor       tagStrategyExecutor;
    @Mock TagDefinitionService      tagDefinitionService;
    @Mock ApplicationEventPublisher publisher;

    TagAdminService service;

    @BeforeEach
    void setUp() {
        service = new TagAdminService(tagRepository, recordRepository, tagMapper,
                tagStrategyExecutor, tagDefinitionService, publisher);
        // A tag that exists and is hand-curated, so requireManual lets the call through to the
        // null/empty guard these tests are about.
        when(tagStrategyExecutor.managedTagTypes()).thenReturn(Set.of("TRENDING"));
        when(tagDefinitionService.exists(MANUAL_TAG)).thenReturn(true);
        when(tagDefinitionService.isAutomatic(MANUAL_TAG)).thenReturn(false);
    }

    @Test
    void bulkAddWithNullIdsIsANoOp() {
        assertThatCode(() -> assertThat(service.bulkAdd(MANUAL_TAG, null, 1)).isZero())
                .doesNotThrowAnyException();
        verifyNoInteractions(recordRepository);
        verifyNoInteractions(publisher);
    }

    @Test
    void bulkRemoveWithNullIdsIsANoOp() {
        assertThatCode(() -> assertThat(service.bulkRemove(MANUAL_TAG, null)).isZero())
                .doesNotThrowAnyException();
        verifyNoInteractions(recordRepository);
        verifyNoInteractions(publisher);
    }

    @Test
    void bulkAddWithEmptyIdsIsANoOp() {
        assertThat(service.bulkAdd(MANUAL_TAG, List.of(), 1)).isZero();
        verifyNoInteractions(recordRepository);
        verifyNoInteractions(publisher);
    }

    @Test
    void bulkRemoveWithEmptyIdsIsANoOp() {
        assertThat(service.bulkRemove(MANUAL_TAG, List.of())).isZero();
        verifyNoInteractions(recordRepository);
        verifyNoInteractions(publisher);
    }
}
