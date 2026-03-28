package com.db.dbworld.app.cinema.tmdb.ingestion;

import com.db.dbworld.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.cinema.tmdb.people.entity.PersonEntity;

import java.util.List;

public interface TmdbIngestionService {

    /* ======================================================
       MOVIE OPERATIONS
       ====================================================== */

    /**
     * Ingest a new movie. Throws exception if already exists.
     * @param tmdbId TMDB movie ID
     * @return saved movie entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbIngestionException if movie already exists
     */
    MovieTmdbEntity ingestMovie(Long tmdbId);

    /**
     * Ingest multiple new movies. Skips existing ones with warning.
     * @param tmdbIds List of TMDB movie IDs
     * @return List of successfully saved movie entities
     */
    List<MovieTmdbEntity> ingestMovies(List<Long> tmdbIds);

    /**
     * Refresh an existing movie (delete and insert again).
     * @param tmdbId TMDB movie ID
     * @return refreshed movie entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbNotFoundException if movie doesn't exist
     */
    MovieTmdbEntity refreshMovie(Long tmdbId);

    /**
     * Refresh multiple existing movies.
     * @param tmdbIds List of TMDB movie IDs
     * @return List of successfully refreshed movie entities
     */
    List<MovieTmdbEntity> refreshMovies(List<Long> tmdbIds);


    /* ======================================================
       TV SERIES OPERATIONS
       ====================================================== */

    /**
     * Ingest a new TV series. Throws exception if already exists.
     * @param tmdbId TMDB TV series ID
     * @return saved TV series entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbIngestionException if series already exists
     */
    TvSeriesTmdbEntity ingestTvSeries(Long tmdbId);

    /**
     * Ingest multiple new TV series. Skips existing ones with warning.
     * @param tmdbIds List of TMDB TV series IDs
     * @return List of successfully saved TV series entities
     */
    List<TvSeriesTmdbEntity> ingestTvSeries(List<Long> tmdbIds);

    /**
     * Refresh an existing TV series (delete and insert again).
     * @param tmdbId TMDB TV series ID
     * @return refreshed TV series entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbNotFoundException if series doesn't exist
     */
    TvSeriesTmdbEntity refreshTvSeries(Long tmdbId);

    /**
     * Refresh multiple existing TV series.
     * @param tmdbIds List of TMDB TV series IDs
     * @return List of successfully refreshed TV series entities
     */
    List<TvSeriesTmdbEntity> refreshTvSeries(List<Long> tmdbIds);


    /* ======================================================
       PERSON OPERATIONS
       ====================================================== */

    /**
     * Ingest a new person. Throws exception if already exists.
     * @param personId TMDB person ID
     * @return saved person entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbIngestionException if person already exists
     */
    PersonEntity ingestPerson(Long personId);

    /**
     * Ingest multiple new persons. Skips existing ones with warning.
     * @param personIds List of TMDB person IDs
     * @return List of successfully saved person entities
     */
    List<PersonEntity> ingestPersons(List<Long> personIds);

    /**
     * Refresh an existing person (delete and insert again).
     * @param personId TMDB person ID
     * @return refreshed person entity
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbNotFoundException if person doesn't exist
     */
    PersonEntity refreshPerson(Long personId);

    /**
     * Refresh multiple existing persons.
     * @param personIds List of TMDB person IDs
     * @return List of successfully refreshed person entities
     */
    List<PersonEntity> refreshPersons(List<Long> personIds);


    /* ======================================================
       DELETE OPERATIONS
       ====================================================== */

    /**
     * Delete a single media item (movie or TV series).
     * @param tmdbId TMDB ID of the media to delete
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbNotFoundException if media doesn't exist
     */
    void deleteMedia(Long tmdbId);

    /**
     * Delete multiple media items.
     * @param tmdbIds List of TMDB IDs to delete
     */
    void deleteMedia(List<Long> tmdbIds);

    /**
     * Delete a single person.
     * @param personId TMDB person ID to delete
     * @throws com.db.dbworld.cinema.tmdb.exception.TmdbNotFoundException if person doesn't exist
     */
    void deletePerson(Long personId);

    /**
     * Delete multiple persons.
     * @param personIds List of TMDB person IDs to delete
     */
    void deletePersons(List<Long> personIds);

}