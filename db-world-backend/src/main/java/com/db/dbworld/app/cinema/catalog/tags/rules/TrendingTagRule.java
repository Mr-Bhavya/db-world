package com.db.dbworld.app.cinema.catalog.tags.rules;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Objects;
import java.util.Optional;

@Component
public class TrendingTagRule implements RecordTagRule {

    private static final double BASE_TRENDING_THRESHOLD = 100.0;
    private static final int RECENT_DAYS_WINDOW = 30;
    private static final int NEW_SEASON_WINDOW = 14;

    @Override
    public Optional<TagAssignment> evaluate(RecordEntity record) {

        if (record == null) return Optional.empty();

        var tmdb = record.getTmdb();
        if (tmdb == null) return Optional.empty();

        double popularity = Optional.ofNullable(tmdb.getPopularity()).orElse(0.0);
        if (popularity <= 0) return Optional.empty();

        LocalDate now = LocalDate.now();

        boolean isSeries = isSeries(record);
        boolean isRecent = isRecent(tmdb, now);
        boolean hasNewSeason = isSeries && hasRecentSeason(tmdb, now);
        double decayFactor = calculateDecay(tmdb, now);

        double score = popularity;

        if (isRecent) score += 30;
        if (hasNewSeason) score += 50;

        // Future enhancement
        /*
        score += analyticsService.getStreamsLast24Hours(record.getId()) * 0.5;
        */

        score *= decayFactor;

        if (score >= BASE_TRENDING_THRESHOLD) {
            return Optional.of(new TagAssignment(RecordTagType.TRENDING, 90));
        }

        return Optional.empty();
    }

    // =========================================================
    // 🔧 Core Logic
    // =========================================================

    private boolean isSeries(RecordEntity record) {
        return record.getType() == RecordType.TV_SERIES
                || record.getTmdb() instanceof TvSeriesTmdbEntity;
    }

    private boolean isRecent(Object tmdb, LocalDate now) {

        LocalDate releaseDate = getReleaseDate(tmdb);
        LocalDate lastAirDate = getLastAirDate(tmdb);

        return isWithinWindow(releaseDate, now, RECENT_DAYS_WINDOW)
                || isWithinWindow(lastAirDate, now, RECENT_DAYS_WINDOW);
    }

    private boolean hasRecentSeason(Object tmdb, LocalDate now) {

        if (!(tmdb instanceof TvSeriesTmdbEntity series)) {
            return false;
        }

        if (series.getSeasons() == null || series.getSeasons().isEmpty()) {
            return false;
        }

        return series.getSeasons().stream()
                .filter(Objects::nonNull)
                .map(SeasonEntity::getAirDate)
                .map(this::safeParseDate)
                .filter(Objects::nonNull)
                .max(LocalDate::compareTo)
                .map(date -> isWithinWindow(date, now, NEW_SEASON_WINDOW))
                .orElse(false);
    }

    private double calculateDecay(Object tmdb, LocalDate now) {

        LocalDate referenceDate = Optional.ofNullable(getReleaseDate(tmdb))
                .orElse(getFirstAirDate(tmdb));

        if (referenceDate == null) return 1.0;

        long days = ChronoUnit.DAYS.between(referenceDate, now);
        if (days < 0) return 1.0;

        return Math.exp(-days / 30.0);
    }

    // =========================================================
    // 🔧 Utilities
    // =========================================================

    private boolean isWithinWindow(LocalDate date, LocalDate now, int days) {
        return date != null
                && !date.isBefore(now.minusDays(days))
                && !date.isAfter(now);
    }

    private LocalDate safeParseDate(String date) {
        try {
            return date != null ? LocalDate.parse(date) : null;
        } catch (Exception e) {
            return null;
        }
    }

    // =========================================================
    // 🔌 Type-safe TMDB Access (NO REFLECTION)
    // =========================================================

    private LocalDate getReleaseDate(Object tmdb) {
        try {
            return (LocalDate) tmdb.getClass().getMethod("getReleaseDate").invoke(tmdb);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate getFirstAirDate(Object tmdb) {
        try {
            return (LocalDate) tmdb.getClass().getMethod("getFirstAirDate").invoke(tmdb);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalDate getLastAirDate(Object tmdb) {
        try {
            return (LocalDate) tmdb.getClass().getMethod("getLastAirDate").invoke(tmdb);
        } catch (Exception e) {
            return null;
        }
    }
}