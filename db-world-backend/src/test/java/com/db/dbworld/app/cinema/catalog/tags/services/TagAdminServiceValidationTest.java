package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordTagMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.catalog.tags.strategy.TagStrategyExecutor;
import com.db.dbworld.app.cinema.common.events.BulkRecordChangedEvent;
import com.db.dbworld.app.cinema.common.events.RecordChangedEvent;
import com.db.dbworld.app.cinema.enums.RecordType;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards on tag names. Tag types are free-form strings now (so admins can create their own tags),
 * which means these runtime checks replace what {@code RecordTagType} used to enforce at compile
 * time. Without them a typo would write an orphan tag_type nothing renders.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagAdminServiceValidationTest {

    @Mock RecordTagRepository tagRepository;
    @Mock RecordRepository recordRepository;
    @Mock RecordTagMapper tagMapper;
    @Mock TagStrategyExecutor tagStrategyExecutor;
    @Mock TagDefinitionService tagDefinitionService;
    @Mock ApplicationEventPublisher publisher;

    TagAdminService service;

    @BeforeEach
    void setUp() {
        service = new TagAdminService(tagRepository, recordRepository, tagMapper,
                tagStrategyExecutor, tagDefinitionService, publisher);
        // TRENDING is computed (a built-in strategy), CRITIC_FAVOURITES is computed (an admin rule),
        // DIWALI_SPECIAL is hand-curated. "Automatic" is resolved by TagDefinitionService, which is
        // what requireManual consults — so both kinds of computed tag are rejected by one check.
        when(tagStrategyExecutor.managedTagTypes()).thenReturn(Set.of("TRENDING"));
        when(tagDefinitionService.exists("TRENDING")).thenReturn(true);
        when(tagDefinitionService.exists("CRITIC_FAVOURITES")).thenReturn(true);
        when(tagDefinitionService.exists("DIWALI_SPECIAL")).thenReturn(true);
        when(tagDefinitionService.exists("NOPE")).thenReturn(false);
        when(tagDefinitionService.isAutomatic("TRENDING")).thenReturn(true);
        when(tagDefinitionService.isAutomatic("CRITIC_FAVOURITES")).thenReturn(true);
        when(tagDefinitionService.isAutomatic("DIWALI_SPECIAL")).thenReturn(false);
    }

    @Test
    void requireExisting_canonicalisesBeforeLookup() {
        // An admin typing the display name must resolve to the stored slug.
        assertThat(service.requireExisting("diwali special")).isEqualTo("DIWALI_SPECIAL");
    }

    @Test
    void requireExisting_unknownTag_throwsNotFound() {
        assertThatThrownBy(() -> service.requireExisting("nope"))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("NOPE");
    }

    @Test
    void requireExisting_blank_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.requireExisting("   "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void requireManual_automaticTag_isRejectedWithAnExplanation() {
        // The old behaviour silently accepted this and the scheduler wiped it hours later.
        assertThatThrownBy(() -> service.requireManual("TRENDING"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("computed automatically");
    }

    @Test
    void requireManual_manualTag_isAllowed() {
        assertThat(service.requireManual("DIWALI_SPECIAL")).isEqualTo("DIWALI_SPECIAL");
    }

    @Test
    void requireManual_ruleDrivenTag_isAlsoRejected() {
        // An admin-defined rule tag is recomputed on every refresh just like a built-in, so
        // hand-adding to it is equally futile. Same guard, both kinds.
        assertThatThrownBy(() -> service.requireManual("CRITIC_FAVOURITES"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("computed automatically");
    }

    @Test
    void bulkAdd_onAnAutomaticTag_refusesRatherThanQueueingDoomedWork() {
        assertThatThrownBy(() -> service.bulkAdd("TRENDING", List.of(1L), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void bulkAdd_manualTag_tagsTheRecordAndIsIdempotent() {
        RecordEntity record = RecordEntity.builder()
                .id(1L).name("Acme").type(RecordType.MOVIE)
                .tags(new ArrayList<>())
                .build();
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int first = service.bulkAdd("DIWALI_SPECIAL", List.of(1L), 5);
        assertThat(first).isEqualTo(1);
        assertThat(record.getTags()).extracting(RecordTagEntity::getTagType)
                .containsExactly("DIWALI_SPECIAL");

        // Re-adding must not duplicate. This is the case that would have broken silently if the
        // dedup check had stayed as `==` on Strings after the enum was removed.
        int second = service.bulkAdd("DIWALI_SPECIAL", List.of(1L), 5);
        assertThat(second).isZero();
        assertThat(record.getTags()).hasSize(1);
    }

    @Test
    void bulkRemove_manualTag_removesByValueNotIdentity() {
        // A String built at runtime is never the same reference as a literal, so `==` would find
        // nothing here while `.equals` works.
        RecordEntity record = RecordEntity.builder()
                .id(1L).name("Acme").type(RecordType.MOVIE)
                .tags(new ArrayList<>(List.of(
                        RecordTagEntity.builder().tagType(new String("DIWALI_SPECIAL")).priority(1).build())))
                .build();
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int removed = service.bulkRemove("DIWALI_SPECIAL", List.of(1L));

        assertThat(removed).isEqualTo(1);
        assertThat(record.getTags()).isEmpty();
    }

    /* ================================================================
       RAIL CACHE INVALIDATION

       Tag writes used to publish nothing, so a tag change took up to the
       3-minute rail-cache TTL to appear — the admin action looked like a
       no-op. Only the (now deleted) inline catalog path evicted anything.
    ================================================================= */

    private RecordEntity taggedRecord(String tagType) {
        return RecordEntity.builder()
                .id(1L).name("Acme").type(RecordType.MOVIE)
                .tags(new ArrayList<>(List.of(
                        RecordTagEntity.builder().tagType(tagType).priority(1).build())))
                .build();
    }

    @Test
    void bulkAdd_evictsTheRailCacheOnce() {
        RecordEntity record = RecordEntity.builder()
                .id(1L).name("Acme").type(RecordType.MOVIE).tags(new ArrayList<>()).build();
        when(recordRepository.findById(1L)).thenReturn(Optional.of(record));
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.bulkAdd("DIWALI_SPECIAL", List.of(1L), 0);

        // One bulk event, not one per record — a 100-record add would otherwise evict 100 times.
        verify(publisher).publishEvent(any(BulkRecordChangedEvent.class));
    }

    @Test
    void bulkAdd_thatChangedNothing_doesNotEvict() {
        // Re-adding an existing tag is a no-op, so blowing the cache away would be pure waste.
        when(recordRepository.findById(1L)).thenReturn(Optional.of(taggedRecord("DIWALI_SPECIAL")));

        service.bulkAdd("DIWALI_SPECIAL", List.of(1L), 0);

        verify(publisher, never()).publishEvent(any());
    }

    @Test
    void bulkRemove_evictsTheRailCache() {
        when(recordRepository.findById(1L)).thenReturn(Optional.of(taggedRecord("DIWALI_SPECIAL")));
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.bulkRemove("DIWALI_SPECIAL", List.of(1L));

        verify(publisher).publishEvent(any(BulkRecordChangedEvent.class));
    }

    @Test
    void removeTagFromRecord_byName_evictsJustThatRecord() {
        when(recordRepository.findById(1L)).thenReturn(Optional.of(taggedRecord("DIWALI_SPECIAL")));
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        boolean removed = service.removeTagFromRecord(1L, "diwali special");

        assertThat(removed).isTrue();
        // Targeted eviction: only this record's rails are affected.
        verify(publisher).publishEvent(any(RecordChangedEvent.class));
    }

    @Test
    void removeTagFromRecord_onAnAutomaticTag_isRefused() {
        // The endpoint this replaced (DELETE /catalog/{id}/tags/{tagType}) had no such guard, so the
        // inline chip and the Tags page disagreed about whether the operation was allowed.
        assertThatThrownBy(() -> service.removeTagFromRecord(1L, "TRENDING"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void removeTagFromRecord_tagNotPresent_reportsFalseAndDoesNotEvict() {
        when(recordRepository.findById(1L)).thenReturn(Optional.of(taggedRecord("SOMETHING_ELSE")));

        assertThat(service.removeTagFromRecord(1L, "DIWALI_SPECIAL")).isFalse();
        verify(publisher, never()).publishEvent(any());
    }
}
