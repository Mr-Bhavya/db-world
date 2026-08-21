package com.db.dbworld.app.cinema.rail.service.impl;

import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.repository.RailRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Batch rail reordering. This replaced a frontend loop that fired one full PUT per rail — dragging
 * one rail in a 30-rail list sent 30 requests, each rewriting that rail's whole JSON rule, and a
 * partial failure left priorities inconsistent.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RailReorderTest {

    @Mock RailRepository railRepository;
    @InjectMocks RailServiceImpl service;

    private static RailEntity rail(Long id, int priority) {
        return RailEntity.builder().id(id).title("Rail " + id).priority(priority).active(true).build();
    }

    private static Map<Long, Integer> order(Object... pairs) {
        Map<Long, Integer> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            m.put(((Number) pairs[i]).longValue(), (Integer) pairs[i + 1]);
        }
        return m;
    }

    @Test
    void reorder_appliesNewPriorities() {
        RailEntity a = rail(1L, 0);
        RailEntity b = rail(2L, 1);
        when(railRepository.findAllById(any())).thenReturn(List.of(a, b));

        int changed = service.reorderRails(order(1L, 1, 2L, 0));

        assertThat(changed).isEqualTo(2);
        assertThat(a.getPriority()).isEqualTo(1);
        assertThat(b.getPriority()).isZero();
        verify(railRepository).saveAll(List.of(a, b));
    }

    @Test
    void reorder_unchangedPositions_areNotCounted() {
        // Dragging one rail leaves most of the list where it was; only real moves count.
        RailEntity a = rail(1L, 0);
        RailEntity b = rail(2L, 1);
        when(railRepository.findAllById(any())).thenReturn(List.of(a, b));

        int changed = service.reorderRails(order(1L, 0, 2L, 5));

        assertThat(changed).isEqualTo(1);
        assertThat(a.getPriority()).isZero();
        assertThat(b.getPriority()).isEqualTo(5);
    }

    @Test
    void reorder_noActualChange_skipsTheWriteEntirely() {
        RailEntity a = rail(1L, 0);
        when(railRepository.findAllById(any())).thenReturn(List.of(a));

        int changed = service.reorderRails(order(1L, 0));

        assertThat(changed).isZero();
        verify(railRepository, never()).saveAll(any());
    }

    @Test
    void reorder_emptyOrNullPayload_isANoOp() {
        assertThat(service.reorderRails(Map.of())).isZero();
        assertThat(service.reorderRails(null)).isZero();
        verify(railRepository, never()).findAllById(any());
        verify(railRepository, never()).saveAll(any());
    }

    @Test
    void reorder_staleIdForADeletedRail_appliesTheRestInsteadOfFailing() {
        // The admin's list can be stale if someone else deleted a rail. The reorder they asked for
        // should still land rather than 500-ing on the missing id.
        RailEntity a = rail(1L, 0);
        when(railRepository.findAllById(any())).thenReturn(List.of(a));   // id 99 no longer exists

        int changed = service.reorderRails(order(1L, 3, 99L, 4));

        assertThat(changed).isEqualTo(1);
        assertThat(a.getPriority()).isEqualTo(3);
    }
}
