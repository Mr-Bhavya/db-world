package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Both bulk methods logged {@code recordIds != null ? ... : 0}, acknowledging a null
 * list, then immediately iterated it — so a null argument threw NPE rather than being
 * the no-op the log implied.
 */
@ExtendWith(MockitoExtension.class)
class TagAdminServiceTest {

    @Mock RecordTagRepository  tagRepository;
    @Mock RecordRepository     recordRepository;
    @Mock RecordTagMapper      tagMapper;
    @Mock TagStrategyExecutor  tagStrategyExecutor;

    TagAdminService service;

    @BeforeEach
    void setUp() {
        service = new TagAdminService(tagRepository, recordRepository, tagMapper, tagStrategyExecutor);
    }

    @Test
    void bulkAddWithNullIdsIsANoOp() {
        assertThatCode(() -> assertThat(service.bulkAdd(RecordTagType.TRENDING, null, 1)).isZero())
                .doesNotThrowAnyException();
        verifyNoInteractions(recordRepository);
    }

    @Test
    void bulkRemoveWithNullIdsIsANoOp() {
        assertThatCode(() -> assertThat(service.bulkRemove(RecordTagType.TRENDING, null)).isZero())
                .doesNotThrowAnyException();
        verifyNoInteractions(recordRepository);
    }

    @Test
    void bulkAddWithEmptyIdsIsANoOp() {
        assertThat(service.bulkAdd(RecordTagType.TRENDING, List.of(), 1)).isZero();
        verifyNoInteractions(recordRepository);
    }

    @Test
    void bulkRemoveWithEmptyIdsIsANoOp() {
        assertThat(service.bulkRemove(RecordTagType.TRENDING, List.of())).isZero();
        verifyNoInteractions(recordRepository);
    }
}
