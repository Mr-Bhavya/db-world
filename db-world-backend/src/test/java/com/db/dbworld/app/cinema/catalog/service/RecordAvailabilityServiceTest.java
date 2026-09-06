package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAvailabilityDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * The availability rollup exists because the record page used to infer "we do not have
 * this" from an authenticated endpoint returning nothing to a signed-out visitor, and
 * then offered to REQUEST titles that were sitting in the library. These cover the
 * counting rules that make the answer trustworthy.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecordAvailabilityServiceTest {

    @Mock MediaFileRepository mediaFileRepository;
    @Mock SeasonRepository seasonRepository;

    RecordAvailabilityService service;

    @BeforeEach
    void setUp() {
        service = new RecordAvailabilityService(mediaFileRepository, seasonRepository);
    }

    private RecordEntity series(long id, Long tmdbId) {
        TmdbEntity tmdb = new TmdbEntity();
        tmdb.setId(tmdbId);
        return RecordEntity.builder().id(id).type(RecordType.TV_SERIES).tmdb(tmdb).build();
    }

    private RecordEntity movie(long id) {
        return RecordEntity.builder().id(id).type(RecordType.MOVIE).build();
    }

    private SeasonEntity season(int number, Integer episodeCount) {
        SeasonEntity s = new SeasonEntity();
        s.setSeasonNumber(number);
        s.setEpisodeCount(episodeCount);
        return s;
    }

    private void files(Object[]... pairs) {
        when(mediaFileRepository.findSeasonEpisodePairsByRecordId(anyLong()))
                .thenReturn(List.of(pairs));
    }

    /* ── movies ── */

    @Test
    void movieWithFilesIsAvailableAndCarriesNoEpisodeCounts() {
        files(new Object[]{null, null});

        RecordAvailabilityDto a = service.of(movie(1L));

        assertThat(a.available()).isTrue();
        assertThat(a.episodesHave()).isNull();
        assertThat(a.episodesTotal()).isNull();
        assertThat(a.seasons()).isEmpty();
    }

    @Test
    void movieWithNoFilesIsUnavailable() {
        when(mediaFileRepository.findSeasonEpisodePairsByRecordId(anyLong())).thenReturn(List.of());
        assertThat(service.of(movie(1L)).available()).isFalse();
    }

    /* ── the counting rules ── */

    @Test
    void countsDistinctEpisodesRatherThanFiles() {
        // Episode 1 in three qualities. Counting rows would report "3 of 2".
        files(new Object[]{1, 1}, new Object[]{1, 1}, new Object[]{1, 1}, new Object[]{1, 2});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong())).thenReturn(List.of(season(1, 2)));

        RecordAvailabilityDto a = service.of(series(1L, 99L));

        assertThat(a.episodesHave()).isEqualTo(2);
        assertThat(a.episodesTotal()).isEqualTo(2);
        assertThat(a.seasons()).singleElement()
                .satisfies(s -> assertThat(s.complete()).isTrue());
    }

    @Test
    void reportsSeasonsWithNothingHeld_becauseThoseAreTheOnesWorthRequesting() {
        // Driven by TMDB, not by the files: iterating files would omit season 2 entirely
        // and the UI would have nothing to offer a request against.
        files(new Object[]{1, 1}, new Object[]{1, 2});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong()))
                .thenReturn(List.of(season(1, 2), season(2, 10)));

        RecordAvailabilityDto a = service.of(series(1L, 99L));

        assertThat(a.seasons()).hasSize(2);
        assertThat(a.seasons().get(1).season()).isEqualTo(2);
        assertThat(a.seasons().get(1).have()).isZero();
        assertThat(a.seasons().get(1).total()).isEqualTo(10);
        assertThat(a.seasons().get(1).complete()).isFalse();
        assertThat(a.episodesHave()).isEqualTo(2);
        assertThat(a.episodesTotal()).isEqualTo(12);
    }

    @Test
    void filesWithNoEpisodeMappingStillMakeTheSeriesAvailable() {
        // The ingestion pipeline did not map these to episodes. Reporting the series
        // unavailable would offer a request for something already playable.
        files(new Object[]{null, null}, new Object[]{null, null});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong())).thenReturn(List.of(season(1, 6)));

        RecordAvailabilityDto a = service.of(series(1L, 99L));

        assertThat(a.available()).isTrue();
        assertThat(a.episodesHave()).isZero();
        assertThat(a.episodesTotal()).isEqualTo(6);
    }

    @Test
    void seasonZeroIsSpecialsAndCountsAsARealSeason() {
        // Season 0 must not be conflated with a null mapping.
        files(new Object[]{0, 1});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong())).thenReturn(List.of(season(0, 3)));

        assertThat(service.of(series(1L, 99L)).seasons()).singleElement()
                .satisfies(s -> {
                    assertThat(s.season()).isZero();
                    assertThat(s.have()).isEqualTo(1);
                });
    }

    @Test
    void aSeasonTmdbDoesNotListIsKeptRatherThanDropped() {
        // Mis-tagged ingest, or TMDB reorganising the show. total = have so it never
        // renders as "4 of 0", and the episodes are not lost from the totals.
        files(new Object[]{1, 1}, new Object[]{7, 1}, new Object[]{7, 2});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong())).thenReturn(List.of(season(1, 1)));

        RecordAvailabilityDto a = service.of(series(1L, 99L));

        assertThat(a.seasons()).extracting(s -> s.season()).containsExactly(1, 7);
        assertThat(a.seasons().get(1).have()).isEqualTo(2);
        assertThat(a.seasons().get(1).total()).isEqualTo(2);
        assertThat(a.episodesHave()).isEqualTo(3);
    }

    @Test
    void nullEpisodeCountFallsBackToTheEpisodesActuallyIngested() {
        // Better than advertising "of 0", which reads as a series with no episodes.
        files(new Object[]{1, 1});
        SeasonEntity s = season(1, null);
        s.setEpisodes(List.of());
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong())).thenReturn(List.of(s));

        assertThat(service.of(series(1L, 99L)).seasons()).singleElement()
                .satisfies(x -> assertThat(x.total()).isZero());
    }

    @Test
    void seasonsAreOrderedByNumber() {
        files(new Object[]{2, 1});
        when(seasonRepository.findWithEpisodesByTvShowId(anyLong()))
                .thenReturn(List.of(season(3, 1), season(1, 1), season(2, 1)));

        assertThat(service.of(series(1L, 99L)).seasons())
                .extracting(s -> s.season()).containsExactly(1, 2, 3);
    }

    /* ── defensive ── */

    @Test
    void nullRecordDoesNotThrow() {
        assertThat(service.of(null).available()).isFalse();
    }

    @Test
    void seriesWithNoTmdbRelationStillReportsWhatIsHeld() {
        files(new Object[]{1, 1}, new Object[]{1, 2});

        RecordAvailabilityDto a = service.of(
                RecordEntity.builder().id(1L).type(RecordType.TV_SERIES).build());

        assertThat(a.available()).isTrue();
        assertThat(a.seasons()).singleElement()
                .satisfies(s -> assertThat(s.have()).isEqualTo(2));
    }
}
