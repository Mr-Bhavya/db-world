package com.db.dbworld.app.cinema.bootstrap.service;

import com.db.dbworld.app.cinema.enums.PageType;
import com.db.dbworld.app.cinema.rail.entity.RailEntity;
import com.db.dbworld.app.cinema.rail.repository.RailRepository;
import com.db.dbworld.app.cinema.rail.rule.RailRule;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RailBootstrapService {

    private final RailRepository railRepository;

    public void generateRails() {

        createHomeRails();
        createMovieRails();
        createSeriesRails();
    }

    /* ================================================================
       HOME PAGE RAILS  (mixed movies + series, like Netflix home)
    ================================================================= */

    private void createHomeRails() {

        // --- Tag-based ---
        createRail("Trending Now",
                ruleTag("TRENDING", "popularity", "DESC"),
                PageType.HOME, 1, false, 20);

        createRail("Top 10 Today",
                ruleTag("TOP_10", "popularity", "DESC"),
                PageType.HOME, 2, false, 10);

        createRail("New Releases",
                ruleTag("NEW_RELEASE", "releaseDate", "DESC"),
                PageType.HOME, 3, false, 20);

        createRail("Recently Added",
                ruleTag("RECENTLY_ADDED", "createdAt", "DESC"),
                PageType.HOME, 4, true, 20);

        createRail("Featured",
                ruleTag("FEATURED", "voteAverage", "DESC"),
                PageType.HOME, 5, false, 20);

        createRail("Editor's Picks",
                ruleTag("EDITOR_PICK", "voteAverage", "DESC"),
                PageType.HOME, 6, false, 20);

        createRail("Show On Top",
                ruleTag("SHOW_ON_TOP", "popularity", "DESC"),
                PageType.HOME, 0, false, 20);

        // --- Genre-based (all content) ---
        createRail("Action & Adventure",
                ruleGenre(28L, "popularity", "DESC"),
                PageType.HOME, 10, true, 20);

        createRail("Comedy",
                ruleGenre(35L, "popularity", "DESC"),
                PageType.HOME, 11, true, 20);

        createRail("Drama",
                ruleGenre(18L, "popularity", "DESC"),
                PageType.HOME, 12, true, 20);

        createRail("Horror",
                ruleGenre(27L, "popularity", "DESC"),
                PageType.HOME, 13, true, 20);

        createRail("Romance",
                ruleGenre(10749L, "popularity", "DESC"),
                PageType.HOME, 14, true, 20);

        createRail("Sci-Fi & Fantasy",
                ruleGenre(878L, "popularity", "DESC"),
                PageType.HOME, 15, true, 20);

        createRail("Thriller",
                ruleGenre(53L, "popularity", "DESC"),
                PageType.HOME, 16, true, 20);

        createRail("Animation",
                ruleGenre(16L, "popularity", "DESC"),
                PageType.HOME, 17, true, 20);

        // --- Language-based ---
        createRail("Hollywood Hits",
                ruleLanguage(List.of("en"), "popularity", "DESC"),
                PageType.HOME, 30, true, 20);

        createRail("Bollywood Blockbusters",
                ruleLanguage(List.of("hi"), "popularity", "DESC"),
                PageType.HOME, 31, true, 20);

        createRail("South Indian Cinema",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC"),
                PageType.HOME, 32, true, 20);

        createRail("Korean Wave",
                ruleLanguage(List.of("ko"), "popularity", "DESC"),
                PageType.HOME, 33, true, 20);

        // --- Filter-based ---
        createRail("Critically Acclaimed",
                ruleFilter("voteAverage", 8.0, null, "voteAverage", "DESC"),
                PageType.HOME, 40, true, 20);

        createRail("Most Popular",
                ruleFilter(null, null, null, "popularity", "DESC"),
                PageType.HOME, 41, true, 20);
    }

    /* ================================================================
       MOVIES PAGE RAILS  (recordType locked to MOVIE)
    ================================================================= */

    private void createMovieRails() {

        // --- Tag-based ---
        createRail("Trending Movies",
                ruleTag("TRENDING", "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 1, false, 20);

        createRail("Top 10 Movies Today",
                ruleTag("TOP_10", "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 2, false, 10);

        createRail("New Movie Releases",
                ruleTag("NEW_RELEASE", "releaseDate", "DESC", "MOVIE"),
                PageType.MOVIES, 3, false, 20);

        createRail("Recently Added Movies",
                ruleTag("RECENTLY_ADDED", "createdAt", "DESC", "MOVIE"),
                PageType.MOVIES, 4, true, 20);

        createRail("Featured Movies",
                ruleTag("FEATURED", "voteAverage", "DESC", "MOVIE"),
                PageType.MOVIES, 5, false, 20);

        createRail("Editor's Pick Movies",
                ruleTag("EDITOR_PICK", "voteAverage", "DESC", "MOVIE"),
                PageType.MOVIES, 6, false, 20);

        // --- Genre-based (movies only) ---
        createRail("Action Movies",
                ruleGenre(28L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 10, true, 20);

        createRail("Comedy Movies",
                ruleGenre(35L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 11, true, 20);

        createRail("Drama Movies",
                ruleGenre(18L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 12, true, 20);

        createRail("Horror Movies",
                ruleGenre(27L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 13, true, 20);

        createRail("Romance Movies",
                ruleGenre(10749L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 14, true, 20);

        createRail("Sci-Fi Movies",
                ruleGenre(878L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 15, true, 20);

        createRail("Thriller Movies",
                ruleGenre(53L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 16, true, 20);

        createRail("Animated Movies",
                ruleGenre(16L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 17, true, 20);

        createRail("Documentary Movies",
                ruleGenre(99L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 18, true, 20);

        createRail("Mystery Movies",
                ruleGenre(9648L, "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 19, true, 20);

        // --- Language-based (movies only) ---
        createRail("Hollywood Movies",
                ruleLanguage(List.of("en"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 30, true, 20);

        createRail("Bollywood Movies",
                ruleLanguage(List.of("hi"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 31, true, 20);

        createRail("South Indian Movies",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 32, true, 20);

        createRail("Korean Movies",
                ruleLanguage(List.of("ko"), "popularity", "DESC", "MOVIE"),
                PageType.MOVIES, 33, true, 20);

        // --- Filter-based (movies only) ---
        createRail("Highest Rated Movies",
                ruleFilter("voteAverage", 8.0, "MOVIE", "voteAverage", "DESC"),
                PageType.MOVIES, 40, true, 20);

        createRail("Most Popular Movies",
                ruleFilter(null, null, "MOVIE", "popularity", "DESC"),
                PageType.MOVIES, 41, true, 20);
    }

    /* ================================================================
       SERIES / TV SHOWS PAGE RAILS  (recordType locked to TV_SERIES)
    ================================================================= */

    private void createSeriesRails() {

        // --- Tag-based ---
        createRail("Trending TV Shows",
                ruleTag("TRENDING", "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 1, false, 20);

        createRail("Top 10 TV Shows Today",
                ruleTag("TOP_10", "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 2, false, 10);

        createRail("New TV Show Releases",
                ruleTag("NEW_RELEASE", "releaseDate", "DESC", "TV_SERIES"),
                PageType.SERIES, 3, false, 20);

        createRail("Recently Added TV Shows",
                ruleTag("RECENTLY_ADDED", "createdAt", "DESC", "TV_SERIES"),
                PageType.SERIES, 4, true, 20);

        createRail("Featured TV Shows",
                ruleTag("FEATURED", "voteAverage", "DESC", "TV_SERIES"),
                PageType.SERIES, 5, false, 20);

        createRail("Editor's Pick TV Shows",
                ruleTag("EDITOR_PICK", "voteAverage", "DESC", "TV_SERIES"),
                PageType.SERIES, 6, false, 20);

        // --- Genre-based (TV only, using TMDB TV genre IDs) ---
        createRail("Action & Adventure Series",
                ruleGenre(10759L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 10, true, 20);

        createRail("Comedy Series",
                ruleGenre(35L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 11, true, 20);

        createRail("Drama Series",
                ruleGenre(18L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 12, true, 20);

        createRail("Crime Series",
                ruleGenre(80L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 13, true, 20);

        createRail("Sci-Fi & Fantasy Series",
                ruleGenre(10765L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 14, true, 20);

        createRail("Mystery Series",
                ruleGenre(9648L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 15, true, 20);

        createRail("Animated Series",
                ruleGenre(16L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 16, true, 20);

        createRail("Documentary Series",
                ruleGenre(99L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 17, true, 20);

        createRail("Reality TV",
                ruleGenre(10764L, "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 18, true, 20);

        createRail("K-Drama",
                ruleLanguage(List.of("ko"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 19, true, 20);

        // --- Language-based (TV only) ---
        createRail("English TV Shows",
                ruleLanguage(List.of("en"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 30, true, 20);

        createRail("Hindi TV Shows",
                ruleLanguage(List.of("hi"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 31, true, 20);

        createRail("South Indian TV Shows",
                ruleLanguage(List.of("ta", "te", "ml", "kn"), "popularity", "DESC", "TV_SERIES"),
                PageType.SERIES, 32, true, 20);

        // --- Filter-based (TV only) ---
        createRail("Highest Rated TV Shows",
                ruleFilter("voteAverage", 8.0, "TV_SERIES", "voteAverage", "DESC"),
                PageType.SERIES, 40, true, 20);

        createRail("Most Popular TV Shows",
                ruleFilter(null, null, "TV_SERIES", "popularity", "DESC"),
                PageType.SERIES, 41, true, 20);
    }

    /* ================================
       RULE BUILDERS
    ================================= */

    private RailRule ruleTag(String tag, String sort, String direction) {
        return ruleTag(tag, sort, direction, null);
    }

    private RailRule ruleTag(String tag, String sort, String direction, String recordType) {

        RailRule rule = new RailRule();
        rule.setType("tag");
        rule.setTag(tag);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);

        return rule;
    }

    private RailRule ruleGenre(Long genreId, String sort, String direction) {
        return ruleGenre(genreId, sort, direction, null);
    }

    private RailRule ruleGenre(Long genreId, String sort, String direction, String recordType) {

        RailRule rule = new RailRule();
        rule.setType("genre");
        rule.setGenreId(genreId);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);

        return rule;
    }

    private RailRule ruleLanguage(List<String> languages, String sort, String direction) {
        return ruleLanguage(languages, sort, direction, null);
    }

    private RailRule ruleLanguage(List<String> languages, String sort, String direction, String recordType) {

        RailRule rule = new RailRule();
        rule.setType("language");
        rule.setLanguages(languages);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);

        return rule;
    }

    private RailRule ruleFilter(String field, Object value, String recordType, String sort, String direction) {

        RailRule rule = new RailRule();
        rule.setType("filter");
        rule.setField(field);
        rule.setValue(value);
        rule.setSort(sort);
        rule.setDirection(direction);
        rule.setRecordType(recordType);

        return rule;
    }

    /* ================================
       CREATE RAIL
    ================================= */

    private void createRail(String title, RailRule rule, PageType pageType,
                            int priority, boolean infiniteScroll, int limit) {

        if (railRepository.existsByTitle(title)) {
            return;
        }

        RailEntity rail = RailEntity.builder()
                .title(title)
                .rule(rule)
                .pageType(pageType)
                .priority(priority)
                .limitSize(limit)
                .active(true)
                .infiniteScroll(infiniteScroll)
                .build();

        railRepository.save(rail);
    }
}
