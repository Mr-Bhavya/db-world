package com.db.dbworld.app.cinema.catalog.service.impl;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.cinema.catalog.dto.RecordDto;
import com.db.dbworld.app.cinema.catalog.dto.request.UpdateRecordRequest;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.mapper.RecordMapper;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.enums.RecordVisibility;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.repository.TmdbRepository;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;
import com.db.dbworld.app.cinema.tmdb.sync.service.TmdbRecordSyncService;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.core.push.PushService;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The record publish/visibility behaviour: the "new title" push fires once, only when a record is
 * PUBLISHED with media, and drafts are kept out of the public read. (The cinema catalog had no unit
 * tests before — this covers the new lifecycle logic specifically.)
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CatalogServiceVisibilityTest {

    @Mock RecordRepository recordRepository;
    @Mock TmdbRepository tmdbRepository;
    @Mock SeasonRepository seasonRepository;
    @Mock TmdbIngestionService tmdbIngestionService;
    @Mock TmdbRecordSyncService tmdbRecordSyncService;
    @Mock ApplicationEventPublisher publisher;
    @Mock RecordMapper recordMapper;
    @Mock PushService pushService;
    @Mock MediaFileRepository mediaFileRepository;
    @Mock SettingsService settingsService;

    CatalogServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CatalogServiceImpl(recordRepository, tmdbRepository, seasonRepository,
                tmdbIngestionService, tmdbRecordSyncService, publisher,
                recordMapper, pushService, mediaFileRepository, settingsService);
        when(recordMapper.toDto(any())).thenReturn(new RecordDto());
        when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private static RecordEntity record(Long id, RecordVisibility visibility) {
        return RecordEntity.builder()
                .id(id).name("Acme").type(RecordType.MOVIE).visibility(visibility)
                .build();
    }

    @Test
    void setVisibility_publishWithMedia_broadcastsOnceAndStampsMarker() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));
        when(mediaFileRepository.existsByRecord_Id(1L)).thenReturn(true);

        service.setVisibility(1L, RecordVisibility.PUBLISHED);

        assertThat(r.getVisibility()).isEqualTo(RecordVisibility.PUBLISHED);
        assertThat(r.getNewReleaseNotifiedAt()).isNotNull();
        verify(pushService).broadcast(eq("New on DB World"), eq("Acme"), any(), eq("cinema"));
    }

    @Test
    void setVisibility_publishWithoutMedia_publishesButStaysSilent() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));
        when(mediaFileRepository.existsByRecord_Id(1L)).thenReturn(false);

        service.setVisibility(1L, RecordVisibility.PUBLISHED);

        assertThat(r.getVisibility()).isEqualTo(RecordVisibility.PUBLISHED);
        assertThat(r.getNewReleaseNotifiedAt()).isNull();
        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void setVisibility_alreadyAnnounced_neverReBroadcasts() {
        RecordEntity r = record(1L, RecordVisibility.UNLISTED);
        r.setNewReleaseNotifiedAt(Instant.parse("2026-01-01T00:00:00Z"));
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));

        service.setVisibility(1L, RecordVisibility.PUBLISHED);

        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void onMediaIngested_autoPublishOn_publishesDraftAndBroadcasts() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findById(1L)).thenReturn(Optional.of(r));
        when(settingsService.getBoolean(ConfigKeys.CINEMA_RECORD_AUTO_PUBLISH)).thenReturn(true);
        when(mediaFileRepository.existsByRecord_Id(1L)).thenReturn(true);

        service.onMediaIngested(1L);

        assertThat(r.getVisibility()).isEqualTo(RecordVisibility.PUBLISHED);
        verify(pushService).broadcast(eq("New on DB World"), any(), any(), eq("cinema"));
    }

    @Test
    void onMediaIngested_autoPublishOff_leavesDraftAndSilent() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findById(1L)).thenReturn(Optional.of(r));
        when(settingsService.getBoolean(ConfigKeys.CINEMA_RECORD_AUTO_PUBLISH)).thenReturn(false);

        service.onMediaIngested(1L);

        assertThat(r.getVisibility()).isEqualTo(RecordVisibility.DRAFT);
        verify(pushService, never()).broadcast(any(), any(), any(), any());
    }

    @Test
    void onMediaIngested_publishedEarlyWithoutMedia_announcesWhenMediaArrives() {
        // The "warn but allow" case: admin published before media existed → announce now that it does.
        RecordEntity r = record(1L, RecordVisibility.PUBLISHED);
        when(recordRepository.findById(1L)).thenReturn(Optional.of(r));
        when(settingsService.getBoolean(ConfigKeys.CINEMA_RECORD_AUTO_PUBLISH)).thenReturn(false);
        when(mediaFileRepository.existsByRecord_Id(1L)).thenReturn(true);

        service.onMediaIngested(1L);

        assertThat(r.getNewReleaseNotifiedAt()).isNotNull();
        verify(pushService).broadcast(eq("New on DB World"), any(), any(), eq("cinema"));
    }

    /* ================================================================
       publishedAt — the "Recently published" rail sort key
    ================================================================= */

    @Test
    void setVisibility_firstPublish_stampsPublishedAt() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));

        service.setVisibility(1L, RecordVisibility.PUBLISHED);

        assertThat(r.getPublishedAt()).isNotNull();
    }

    @Test
    void setVisibility_rePublish_keepsOriginalPublishedAt() {
        // Write-once: unpublishing to fix a typo and re-publishing must NOT shove the record
        // back to the top of a "Recently published" rail.
        Instant original = Instant.parse("2026-01-01T00:00:00Z");
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        r.setPublishedAt(original);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));

        service.setVisibility(1L, RecordVisibility.PUBLISHED);

        assertThat(r.getPublishedAt()).isEqualTo(original);
    }

    @Test
    void setVisibility_draftOrUnlisted_neverStampsPublishedAt() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));

        service.setVisibility(1L, RecordVisibility.UNLISTED);

        // UNLISTED is reachable by direct link but deliberately off the rails, so it has no
        // place in a publish-ordered rail until it actually goes PUBLISHED.
        assertThat(r.getPublishedAt()).isNull();
    }

    @Test
    void onMediaIngested_autoPublish_stampsPublishedAt() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findById(1L)).thenReturn(Optional.of(r));
        when(settingsService.getBoolean(ConfigKeys.CINEMA_RECORD_AUTO_PUBLISH)).thenReturn(true);

        service.onMediaIngested(1L);

        assertThat(r.getPublishedAt()).isNotNull();
    }

    @Test
    void updateRecord_publishViaEdit_stampsPublishedAt() {
        // The third way a record gets published: the edit form sending visibility=PUBLISHED.
        MovieTmdbEntity tmdb = mock(MovieTmdbEntity.class);
        when(tmdb.getId()).thenReturn(1402L);
        when(tmdb.getTitle()).thenReturn("Acme");
        RecordEntity r = RecordEntity.builder()
                .id(7L).name("Acme").type(RecordType.MOVIE)
                .visibility(RecordVisibility.DRAFT).tmdb(tmdb).build();
        when(recordRepository.findByIdWithTmdb(7L)).thenReturn(Optional.of(r));

        UpdateRecordRequest req = new UpdateRecordRequest();
        req.setTmdbId(1402L);
        req.setType(RecordType.MOVIE);
        req.setVisibility(RecordVisibility.PUBLISHED);

        service.updateRecord(7L, req);

        assertThat(r.getPublishedAt()).isNotNull();
    }

    @Test
    void getPublicRecord_draft_throwsNotFoundAndNeverMaps() {
        RecordEntity r = record(1L, RecordVisibility.DRAFT);
        when(recordRepository.findByIdWithTmdb(1L)).thenReturn(Optional.of(r));

        assertThatThrownBy(() -> service.getPublicRecord(1L))
                .isInstanceOf(EntityNotFoundException.class);
        verify(recordMapper, never()).toDto(any());
    }

    @Test
    void updateRecord_visibilityOnlyChange_reusesTmdbAndDoesNotReIngest() {
        // Regression: a draft→unlisted/publish edit keeps the same TMDB id+type. Re-ingesting an
        // already-ingested movie used to 500 with "Movie with ID … already exists" — now the existing
        // TMDB entity is reused and ingestMovie/ingestTvSeries are never called.
        MovieTmdbEntity tmdb = mock(MovieTmdbEntity.class);
        when(tmdb.getId()).thenReturn(1402L);
        when(tmdb.getTitle()).thenReturn("Acme");
        RecordEntity r = RecordEntity.builder()
                .id(2271L).name("Acme").type(RecordType.MOVIE)
                .visibility(RecordVisibility.DRAFT).tmdb(tmdb).build();
        when(recordRepository.findByIdWithTmdb(2271L)).thenReturn(Optional.of(r));

        UpdateRecordRequest req = new UpdateRecordRequest();
        req.setType(RecordType.MOVIE);
        req.setTmdbId(1402L);
        req.setVisibility(RecordVisibility.UNLISTED);

        service.updateRecord(2271L, req);

        assertThat(r.getVisibility()).isEqualTo(RecordVisibility.UNLISTED);
        verify(tmdbIngestionService, never()).ingestMovie(any(Long.class));
        verify(tmdbIngestionService, never()).ingestTvSeries(any(Long.class));
    }
}
