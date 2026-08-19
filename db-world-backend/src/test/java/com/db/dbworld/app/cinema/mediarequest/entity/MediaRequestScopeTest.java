package com.db.dbworld.app.cinema.mediarequest.entity;

import com.db.dbworld.core.exception.DbWorldException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Scope normalisation and labelling. The sentinel (-1, not null and not 0) is the whole reason
 * a whole-title request can be de-duplicated by a MySQL unique key while season 0 stays usable
 * as a real season.
 */
class MediaRequestScopeTest {

    @Test
    void noSeasonMeansWholeTitle() {
        MediaRequestScope scope = MediaRequestScope.of(null, null);

        assertThat(scope.isWholeTitle()).isTrue();
        assertThat(scope.season()).isEqualTo(MediaRequestScope.ALL);
        assertThat(scope.episode()).isEqualTo(MediaRequestScope.ALL);
        assertThat(scope.seasonOrNull()).isNull();
        assertThat(scope.episodeOrNull()).isNull();
        assertThat(scope.label()).isEqualTo("All");
    }

    @Test
    void seasonWithoutEpisodeCoversTheSeason() {
        MediaRequestScope scope = MediaRequestScope.of(2, null);

        assertThat(scope.isSeason()).isTrue();
        assertThat(scope.isEpisode()).isFalse();
        assertThat(scope.episode()).isEqualTo(MediaRequestScope.ALL);
        assertThat(scope.label()).isEqualTo("Season 2");
    }

    @Test
    void seasonZeroIsSpecialsAndNotTheSentinel() {
        MediaRequestScope season = MediaRequestScope.of(0, null);
        MediaRequestScope episode = MediaRequestScope.of(0, 5);

        assertThat(season.isWholeTitle()).isFalse();
        assertThat(season.label()).isEqualTo("Specials");
        assertThat(episode.label()).isEqualTo("SP05");
    }

    @Test
    void episodeLabelIsZeroPadded() {
        assertThat(MediaRequestScope.of(2, 5).label()).isEqualTo("S02E05");
        assertThat(MediaRequestScope.of(12, 105).label()).isEqualTo("S12E105");
    }

    @Test
    void episodeWithoutASeasonIsRejected() {
        assertThatThrownBy(() -> MediaRequestScope.of(null, 5))
                .isInstanceOf(DbWorldException.class)
                .satisfies(e -> assertThat(((DbWorldException) e).getHttpStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void negativeNumbersAreRejectedRatherThanReadAsSentinels() {
        assertThatThrownBy(() -> MediaRequestScope.of(-1, null)).isInstanceOf(DbWorldException.class);
        assertThatThrownBy(() -> MediaRequestScope.of(1, -1)).isInstanceOf(DbWorldException.class);
    }

    @Test
    void qualifyAppendsTheScopeOnlyWhenThereIsOne() {
        assertThat(MediaRequestScope.WHOLE_TITLE.qualify("Breaking Bad")).isEqualTo("Breaking Bad");
        assertThat(MediaRequestScope.of(2, 5).qualify("Breaking Bad")).isEqualTo("Breaking Bad · S02E05");
        assertThat(MediaRequestScope.of(2, null).qualify(null)).isEqualTo(" · Season 2");
    }
}
