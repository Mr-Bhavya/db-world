package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestStatus;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Which pending requests an arriving file answers. The bias throughout is towards leaving a
 * request open: an admin closing a done request costs a click, telling somebody their episode
 * landed when it didn't costs their trust in every later notification.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MediaRequestAutoFulfillerTest {

    private static final long RECORD_ID = 42L;

    @Mock MediaRequestRepository requestRepo;
    @Mock MediaFileRepository mediaFileRepo;
    @Mock RecordRepository recordRepo;
    @Mock MediaRequestService requestService;

    MediaRequestAutoFulfiller fulfiller;

    @BeforeEach
    void setUp() {
        fulfiller = new MediaRequestAutoFulfiller(requestRepo, mediaFileRepo, recordRepo, requestService);
    }

    /* ── fixtures ───────────────────────────────────────────────────────────── */

    private void givenPending(MediaRequestEntity... requests) {
        when(requestRepo.findPendingForRecordWithVoters(RECORD_ID)).thenReturn(Arrays.asList(requests));
    }

    private static MediaRequestEntity request(long id, MediaRequestKind kind, int season, int episode) {
        return MediaRequestEntity.builder()
                .id(id).recordId(RECORD_ID).recordTitle("Breaking Bad")
                .recordType(RecordType.TV_SERIES.name())
                .kind(kind).seasonNumber(season).episodeNumber(episode)
                .status(MediaRequestStatus.PENDING)
                .build();
    }

    private void givenFiles(int[]... seasonEpisodePairs) {
        List<MediaFileEntity> files = new ArrayList<>();
        for (int[] pair : seasonEpisodePairs) {
            MediaFileEntity f = new MediaFileEntity();
            if (pair.length > 0 && pair[0] >= 0) f.setTmdbSeasonNumber(pair[0]);
            if (pair.length > 1 && pair[1] >= 0) f.setTmdbEpisodeNumber(pair[1]);
            files.add(f);
        }
        when(mediaFileRepo.findByRecord_Id(RECORD_ID)).thenReturn(files);
    }

    /** A series whose TMDB season 2 lists the given episodes; a null air date means unscheduled. */
    private void givenTmdbSeason(int seasonNumber, String... airDatesByEpisode) {
        SeasonEntity season = new SeasonEntity();
        season.setSeasonNumber(seasonNumber);
        List<EpisodeEntity> episodes = new ArrayList<>();
        for (int i = 0; i < airDatesByEpisode.length; i++) {
            EpisodeEntity e = new EpisodeEntity();
            e.setEpisodeNumber(i + 1);
            e.setAirDate(airDatesByEpisode[i]);
            episodes.add(e);
        }
        season.setEpisodes(episodes);

        TvSeriesTmdbEntity tv = new TvSeriesTmdbEntity();
        tv.setSeasons(List.of(season));
        when(recordRepo.findById(RECORD_ID)).thenReturn(Optional.of(RecordEntity.builder()
                .id(RECORD_ID).name("Breaking Bad").type(RecordType.TV_SERIES).tmdb(tv).build()));
    }

    private static String yesterday() {
        return LocalDate.now().minusDays(1).toString();
    }

    private static String nextWeek() {
        return LocalDate.now().plusDays(7).toString();
    }

    /* ── nothing to do ──────────────────────────────────────────────────────── */

    @Test
    void anIngestThatAnswersNobodyTouchesNothing() {
        givenPending();

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
        // The cheap request lookup comes first, so a normal ingest never reads the file list.
        verifyNoInteractions(mediaFileRepo, requestService);
    }

    @Test
    void aRecordWithNoFilesFulfilsNothing() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, -1, -1));
        when(mediaFileRepo.findByRecord_Id(RECORD_ID)).thenReturn(List.of());

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
        verifyNoInteractions(requestService);
    }

    @Test
    void aNullRecordIdIsANoOp() {
        assertThat(fulfiller.fulfilSatisfied(null)).isZero();
        verifyNoInteractions(requestRepo, mediaFileRepo, requestService);
    }

    /* ── quality kinds stay with the admin ─────────────────────────────────── */

    @Test
    void qualityRequestsAreNeverClosedAutomatically() {
        givenPending(
                request(1L, MediaRequestKind.HIGHER_QUALITY, -1, -1),
                request(2L, MediaRequestKind.LOWER_QUALITY, -1, -1));

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
        verifyNoInteractions(mediaFileRepo, requestService);
    }

    /* ── whole title ───────────────────────────────────────────────────────── */

    @Test
    void aWholeTitleRequestIsAnsweredByTheFirstFile() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, -1, -1));
        givenFiles(new int[]{-1, -1});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
        verify(requestService).fulfill(eq(1L), eq(null), eq(MediaRequestAutoFulfiller.ACTOR));
    }

    @Test
    void aMovieNeedsNoTmdbLookupAtAll() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, -1, -1));
        givenFiles(new int[]{-1, -1});
        when(recordRepo.findById(RECORD_ID)).thenReturn(Optional.of(RecordEntity.builder()
                .id(RECORD_ID).name("Dune").type(RecordType.MOVIE).tmdb(new MovieTmdbEntity()).build()));

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
        verify(recordRepo, never()).findById(anyLong());
    }

    /* ── one episode ───────────────────────────────────────────────────────── */

    @Test
    void anEpisodeRequestIsAnsweredOnlyByThatEpisode() {
        givenPending(
                request(1L, MediaRequestKind.NEW_FILES, 2, 5),
                request(2L, MediaRequestKind.NEW_FILES, 2, 6));
        givenFiles(new int[]{2, 5});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
        verify(requestService).fulfill(eq(1L), any(), any());
        verify(requestService, never()).fulfill(eq(2L), any(), any());
    }

    @Test
    void theSameEpisodeNumberInAnotherSeasonDoesNotCount() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, 5));
        givenFiles(new int[]{3, 5});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
    }

    @Test
    void aFileWithNoEpisodeNumberCannotAnswerAnEpisodeRequest() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, 5));
        givenFiles(new int[]{2, -1});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
    }

    @Test
    void specialsAreMatchedLikeAnyOtherSeason() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 0, 3));
        givenFiles(new int[]{0, 3});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
    }

    /* ── a season ──────────────────────────────────────────────────────────── */

    @Test
    void aSeasonRequestNeedsEveryAiredEpisode() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, -1));
        givenTmdbSeason(2, yesterday(), yesterday(), yesterday());
        givenFiles(new int[]{2, 1}, new int[]{2, 2});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();
    }

    @Test
    void aSeasonRequestClosesOnceTheGapsAreFilled() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, -1));
        givenTmdbSeason(2, yesterday(), yesterday(), yesterday());
        givenFiles(new int[]{2, 1}, new int[]{2, 2}, new int[]{2, 3});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
        verify(requestService).fulfill(eq(1L), eq(null), eq(MediaRequestAutoFulfiller.ACTOR));
    }

    @Test
    void anUnairedEpisodeIsNotHeldAgainstACurrentlyRunningSeason() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, -1));
        givenTmdbSeason(2, yesterday(), yesterday(), nextWeek());
        givenFiles(new int[]{2, 1}, new int[]{2, 2});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
    }

    @Test
    void anEpisodeWithNoAirDateIsTreatedAsUnaired() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, -1));
        givenTmdbSeason(2, yesterday(), null, "");
        givenFiles(new int[]{2, 1});

        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
    }

    @Test
    void aGarbledAirDateNeverThrows() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 2, -1));
        givenTmdbSeason(2, "not-a-date");
        givenFiles(new int[]{2, 1});

        // No aired episodes are known, so it falls back to "the season has files".
        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
    }

    @Test
    void aSeasonTmdbKnowsNothingAboutFallsBackToHavingAnyFileForIt() {
        givenPending(request(1L, MediaRequestKind.NEW_FILES, 7, -1));
        givenTmdbSeason(2, yesterday());

        givenFiles(new int[]{3, 1});
        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isZero();

        givenFiles(new int[]{7, 1});
        assertThat(fulfiller.fulfilSatisfied(RECORD_ID)).isEqualTo(1);
    }

    /* ── the listener wrapper ──────────────────────────────────────────────── */

    @Test
    void aFailureNeverEscapesToTheIngestThatTriggeredIt() {
        when(requestRepo.findPendingForRecordWithVoters(RECORD_ID))
                .thenThrow(new RuntimeException("database is on fire"));

        fulfiller.onMediaFilesChanged(
                new com.db.dbworld.app.cinema.common.events.MediaFilesChangedEvent(RECORD_ID));
    }
}
