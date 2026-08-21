package com.db.dbworld.app.cinema.bootstrap.service;

import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.repository.RailRepository;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Rail bootstrap is seed-only.
 *
 * <p>It used to be an upsert that rewrote {@code rule.sort}, {@code rule.direction} and
 * {@code rule.tag} on every rail it recognised. Hitting the bootstrap endpoint therefore reverted
 * any sort an admin had chosen in the UI — silently, and inconsistently, since priority/limit/
 * pageTypes were left alone. These pin the fix: once a rail exists it is never written to.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RailBootstrapSeedOnlyTest {

    @Mock RailRepository railRepository;
    @InjectMocks RailBootstrapService service;

    @Test
    void emptyDatabase_seedsTheDefaultRails() {
        when(railRepository.findByTitle(anyString())).thenReturn(Optional.empty());

        String summary = service.generateRails();

        assertThat(summary).contains("created");
        // The class defines dozens of default rails; the exact count is not the point, only that
        // seeding happened at all.
        verify(railRepository, org.mockito.Mockito.atLeast(20)).save(any(RailEntity.class));
    }

    @Test
    void existingRail_isNeverWritten_soAdminSortSurvives() {
        // An admin changed "Trending Now" from the default to publishedAt ASC. Re-running bootstrap
        // must not touch it.
        RailRule adminEdited = new RailRule();
        adminEdited.setType("tag");
        adminEdited.setTag("TRENDING");
        adminEdited.setSort("publishedAt");
        adminEdited.setDirection("ASC");

        RailEntity existing = RailEntity.builder()
                .id(1L).title("Trending Now").priority(1).limitSize(20).active(true)
                .rule(adminEdited)
                .build();

        when(railRepository.findByTitle(anyString())).thenReturn(Optional.of(existing));

        String summary = service.generateRails();

        // Nothing saved at all, and the rule is byte-for-byte what the admin left.
        verify(railRepository, never()).save(any(RailEntity.class));
        assertThat(existing.getRule().getSort()).isEqualTo("publishedAt");
        assertThat(existing.getRule().getDirection()).isEqualTo("ASC");
        assertThat(summary).contains("already existed");
    }

    @Test
    void summaryReportsWhatHappened() {
        when(railRepository.findByTitle(anyString())).thenReturn(Optional.empty());

        String summary = service.generateRails();

        // Surfaced to the admin endpoint's response so re-running is self-explanatory.
        assertThat(summary).contains("Rails seeded");
        assertThat(summary).contains("left untouched");
    }
}
