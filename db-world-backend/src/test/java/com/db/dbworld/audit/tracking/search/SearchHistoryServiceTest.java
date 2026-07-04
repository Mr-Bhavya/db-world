package com.db.dbworld.audit.tracking.search;

import com.db.dbworld.audit.tracking.config.TrackingProperties;
import com.db.dbworld.audit.tracking.entity.SearchHistoryEntity;
import com.db.dbworld.audit.tracking.repository.SearchHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SearchHistoryServiceTest {

    @Mock SearchHistoryRepository repository;
    @Mock TrackingProperties trackingProperties;

    SearchHistoryService service;

    @BeforeEach
    void setUp() {
        service = new SearchHistoryService(repository, trackingProperties);
    }

    @Test
    void record_prefixWithinWindow_updatesExistingRowInsteadOfInserting() {
        when(trackingProperties.getSearchPrefixCollapseSec()).thenReturn(30);

        SearchHistoryEntity existing = SearchHistoryEntity.builder()
                .id(1L)
                .userId(7L)
                .queryRaw("da")
                .queryNorm("da")
                .createdAt(Instant.now().minusSeconds(5))
                .build();
        when(repository.findTopByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(existing));

        service.record(7L, "dark", 12, null, "WEB");

        ArgumentCaptor<SearchHistoryEntity> captor = ArgumentCaptor.forClass(SearchHistoryEntity.class);
        verify(repository, times(1)).save(captor.capture());
        verify(repository, never()).save(argThat(e -> e != existing));

        SearchHistoryEntity saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(1L);
        assertThat(saved.getQueryNorm()).isEqualTo("dark");
        assertThat(saved.getQueryRaw()).isEqualTo("dark");
        assertThat(saved.getResultCount()).isEqualTo(12);
    }

    @Test
    void record_reversePrefixWithinWindow_keepsLongerQuery() {
        when(trackingProperties.getSearchPrefixCollapseSec()).thenReturn(30);

        SearchHistoryEntity existing = SearchHistoryEntity.builder()
                .id(2L)
                .userId(7L)
                .queryRaw("dark knight")
                .queryNorm("dark knight")
                .createdAt(Instant.now().minusSeconds(5))
                .build();
        when(repository.findTopByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(existing));

        // New query "dark" is a prefix of the existing longer entry -> collapse, but keep the longer text.
        service.record(7L, "dark", 3, null, "WEB");

        ArgumentCaptor<SearchHistoryEntity> captor = ArgumentCaptor.forClass(SearchHistoryEntity.class);
        verify(repository, times(1)).save(captor.capture());

        SearchHistoryEntity saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(2L);
        assertThat(saved.getQueryNorm()).isEqualTo("dark knight");
        assertThat(saved.getResultCount()).isEqualTo(3);
    }

    @Test
    void record_nonPrefix_insertsNewRow() {
        when(trackingProperties.getSearchPrefixCollapseSec()).thenReturn(30);

        SearchHistoryEntity existing = SearchHistoryEntity.builder()
                .id(1L)
                .userId(7L)
                .queryRaw("batman")
                .queryNorm("batman")
                .createdAt(Instant.now().minusSeconds(5))
                .build();
        when(repository.findTopByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(existing));

        service.record(7L, "superman", 5, null, "WEB");

        ArgumentCaptor<SearchHistoryEntity> captor = ArgumentCaptor.forClass(SearchHistoryEntity.class);
        verify(repository, times(1)).save(captor.capture());

        SearchHistoryEntity saved = captor.getValue();
        assertThat(saved.getId()).isNull();
        assertThat(saved.getQueryNorm()).isEqualTo("superman");
    }

    @Test
    void record_prefixButOutsideWindow_insertsNewRow() {
        when(trackingProperties.getSearchPrefixCollapseSec()).thenReturn(30);

        SearchHistoryEntity existing = SearchHistoryEntity.builder()
                .id(1L)
                .userId(7L)
                .queryRaw("da")
                .queryNorm("da")
                .createdAt(Instant.now().minusSeconds(120))
                .build();
        when(repository.findTopByUserIdOrderByCreatedAtDesc(7L)).thenReturn(Optional.of(existing));

        service.record(7L, "dark", 12, null, "WEB");

        ArgumentCaptor<SearchHistoryEntity> captor = ArgumentCaptor.forClass(SearchHistoryEntity.class);
        verify(repository, times(1)).save(captor.capture());

        SearchHistoryEntity saved = captor.getValue();
        assertThat(saved.getId()).isNull();
        assertThat(saved.getQueryNorm()).isEqualTo("dark");
    }

    @Test
    void record_blankQuery_isNoOp() {
        service.record(7L, "   ", 0, null, "WEB");
        verifyNoInteractions(repository);
    }

    @Test
    void recent_clampsLimit() {
        when(repository.findRecentDistinctQueries(eq(7L), eq(20))).thenReturn(java.util.List.of("dark"));
        service.recent(7L, 999);
        verify(repository).findRecentDistinctQueries(7L, 20);
    }

    @Test
    void clearOne_normalizesQueryBeforeDelete() {
        service.clearOne(7L, "  Dark Knight ");
        verify(repository).deleteByUserIdAndQueryNorm(7L, "dark knight");
    }
}
