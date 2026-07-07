package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface RecordRepository extends JpaRepository<RecordEntity, Long>,
        JpaSpecificationExecutor<RecordEntity>,
        RecordRepositoryCustom {

    Optional<RecordEntity> findByTmdb_Id(Long tmdbId);

    List<RecordEntity> findByType(RecordType type);

    long countByType(RecordType type);

    boolean existsByTmdb_Id(Long tmdbId);

    @Query("""
            SELECT r
            FROM RecordEntity r
            LEFT JOIN FETCH r.tmdb
            WHERE r.id = :id
            """)
    Optional<RecordEntity> findByIdWithTmdb(@Param("id") Long id);

    /* ================================================================
       TAG RAILS
       These keep tmdb join because dynamic Pageable sort may use tmdb fields.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            WHERE tag.tagType = :tag
            """)
    Slice<RecordEntity> findByTag(
            @Param("tag") RecordTagType tag,
            Pageable pageable
    );

    // ── Multi-tag union (combined rails, e.g. NEW_SEASON + NEW_EPISODE) ──────────
    // A record carries at most one of these tags, so no DISTINCT/GROUP BY is needed.

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            WHERE tag.tagType IN :tags
            """)
    Slice<RecordEntity> findByTags(
            @Param("tags") java.util.Collection<RecordTagType> tags,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType IN :tags
            """)
    Slice<Long> findIdsByTags(
            @Param("tags") java.util.Collection<RecordTagType> tags,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType IN :tags
            ORDER BY tag.priority DESC
            """)
    Slice<Long> findIdsByTagsOrderByPriorityDesc(
            @Param("tags") java.util.Collection<RecordTagType> tags,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            WHERE tag.tagType = :tag
            """)
    Slice<Long> findIdsByTag(
            @Param("tag") RecordTagType tag,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            WHERE tag.tagType = :tag
              AND r.type = :recordType
            """)
    Slice<Long> findIdsByTagAndType(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            Pageable pageable
    );

    /* ================================================================
       TAG RAILS - PRIORITY SORT
       These do not need tmdb join because sorting is only by tag.priority.
       Pass unsorted Pageable from service for these methods.
    ================================================================= */

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType = :tag
            ORDER BY tag.priority DESC
            """)
    Slice<Long> findIdsByTagOrderByPriorityDesc(
            @Param("tag") RecordTagType tag,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType = :tag
              AND r.type = :recordType
            ORDER BY tag.priority DESC
            """)
    Slice<Long> findIdsByTagAndTypeOrderByPriorityDesc(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND genre.id = :category
            ORDER BY tag.priority DESC
            """)
    Slice<Long> findIdsByTagAndCategoryOrderByPriorityDesc(
            @Param("tag") RecordTagType tag,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND r.type = :recordType
              AND genre.id = :category
            ORDER BY tag.priority DESC
            """)
    Slice<Long> findIdsByTagAndTypeAndCategoryOrderByPriorityDesc(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType = :tag
            ORDER BY tag.priority ASC
            """)
    Slice<Long> findIdsByTagOrderByPriorityAsc(
            @Param("tag") RecordTagType tag,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            WHERE tag.tagType = :tag
              AND r.type = :recordType
            ORDER BY tag.priority ASC
            """)
    Slice<Long> findIdsByTagAndTypeOrderByPriorityAsc(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND genre.id = :category
            ORDER BY tag.priority ASC
            """)
    Slice<Long> findIdsByTagAndCategoryOrderByPriorityAsc(
            @Param("tag") RecordTagType tag,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND r.type = :recordType
              AND genre.id = :category
            ORDER BY tag.priority ASC
            """)
    Slice<Long> findIdsByTagAndTypeAndCategoryOrderByPriorityAsc(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            @Param("category") Long category,
            Pageable pageable
    );

    /* ================================================================
       GENRE RAILS
       tmdb alias is kept for dynamic sorting on tmdb fields.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE genre.id = :genreId
            """)
    Slice<RecordEntity> findByGenre(
            @Param("genreId") Long genreId,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE genre.id = :genreId
            """)
    Slice<Long> findIdsByGenre(
            @Param("genreId") Long genreId,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE genre.id = :genreId
              AND r.type = :recordType
            """)
    Slice<Long> findIdsByGenreAndType(
            @Param("genreId") Long genreId,
            @Param("recordType") RecordType recordType,
            Pageable pageable
    );

    /* ================================================================
       LANGUAGE RAILS
       tmdb alias is kept for dynamic sorting on tmdb fields.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
            """)
    Slice<RecordEntity> findByLanguages(
            @Param("languages") Collection<String> languages,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
            """)
    Slice<Long> findIdsByLanguages(
            @Param("languages") Collection<String> languages,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
              AND r.type = :recordType
            """)
    Slice<Long> findIdsByLanguagesAndType(
            @Param("languages") Collection<String> languages,
            @Param("recordType") RecordType recordType,
            Pageable pageable
    );

    /* ================================================================
       CATEGORY FILTERED VARIANTS
    ================================================================= */

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND genre.id = :category
            """)
    Slice<Long> findIdsByTagAndCategory(
            @Param("tag") RecordTagType tag,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags tag
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tag.tagType = :tag
              AND r.type = :recordType
              AND genre.id = :category
            """)
    Slice<Long> findIdsByTagAndTypeAndCategory(
            @Param("tag") RecordTagType tag,
            @Param("recordType") RecordType recordType,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tmdb.originalLanguage IN :languages
              AND genre.id = :category
            """)
    Slice<Long> findIdsByLanguagesAndCategory(
            @Param("languages") Collection<String> languages,
            @Param("category") Long category,
            Pageable pageable
    );

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres genre
            WHERE tmdb.originalLanguage IN :languages
              AND r.type = :recordType
              AND genre.id = :category
            """)
    Slice<Long> findIdsByLanguagesAndTypeAndCategory(
            @Param("languages") Collection<String> languages,
            @Param("recordType") RecordType recordType,
            @Param("category") Long category,
            Pageable pageable
    );

    /*
     * findIdsBySpecification is implemented in RecordRepositoryImpl.
     * Do not add @Query here because @Query ignores Specification.
     */

    /* ================================================================
       SEARCH
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE LOWER(tmdb.originalTitle) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(tmdb.title) LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    Page<RecordEntity> search(
            @Param("query") String query,
            Pageable pageable
    );

    @Query("""
            SELECT
                r.id as id,
                tmdb.title as title,
                r.type as type,
                tmdb.posterPath as posterPath,
                tmdb.backdropPath as backdropPath,
                tmdb.voteAverage as voteAverage,
                tmdb.popularity as popularity,
                COALESCE(
                    NULLIF(TRIM(tmdb.releaseDate), ''),
                    NULLIF(TRIM(tmdb.firstAirDate), '')
                ) as releaseDate,
                tmdb.overview as overview,
                tmdb.id as tmdbId,
                TREAT(tmdb as MovieTmdbEntity).runtime as runtime,
                TREAT(tmdb as TvSeriesTmdbEntity).numberOfSeasons as numberOfSeasons
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE LOWER(tmdb.originalTitle) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(tmdb.title) LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    Page<RailRecordProjection> searchProjection(
            @Param("query") String query,
            Pageable pageable
    );

    @Query("""
            SELECT new com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto(
                r.id,
                r.name,
                r.type,
                tmdb.id,
                tmdb.posterPath
            )
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE LOWER(tmdb.originalTitle) LIKE LOWER(CONCAT(:query, '%'))
               OR LOWER(tmdb.title) LIKE LOWER(CONCAT(:query, '%'))
            ORDER BY r.createdAt DESC
            """)
    Page<RecordAutocompleteDto> autocomplete(
            @Param("query") String query,
            Pageable pageable
    );

    /**
     * Autocomplete-shaped projection for a single record id — used to re-hydrate the
     * ingestion form's RecordSearch field when re-editing a job. LEFT JOIN so records
     * without a linked TMDB row still resolve (posterPath just comes back null).
     */
    @Query("""
            SELECT new com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto(
                r.id,
                r.name,
                r.type,
                tmdb.id,
                tmdb.posterPath
            )
            FROM RecordEntity r
            LEFT JOIN r.tmdb tmdb
            WHERE r.id = :id
            """)
    Optional<RecordAutocompleteDto> findAutocompleteById(@Param("id") Long id);

    /* ================================================================
       ADMIN TABLE
    ================================================================= */

    /*
     * findAdminTable(recordId, name, type, tmdbId, year, status, pageable) is
     * implemented in RecordRepositoryImpl (hand-built native query) so ORDER BY
     * can target joined columns (sync state, tmdb year). A @Query here can't —
     * Spring Data prefixes the primary alias `r.` onto native sort columns.
     */

    /* ================================================================
       TAG ADMIN
    ================================================================= */

    @Query(value = """
            SELECT
                r.id AS recordId,
                r.name AS name,
                r.type AS type,
                tm.id AS tmdbId,
                YEAR(
                    COALESCE(
                        NULLIF(TRIM(tm.release_date), ''),
                        NULLIF(TRIM(tm.first_air_date), '')
                    )
                ) AS year,
                r.created_at AS createdAt,
                r.updated_at AS updatedAt,
                GROUP_CONCAT(tag.tag_type ORDER BY tag.priority SEPARATOR ',') AS tags
            FROM records r
            LEFT JOIN tmdb_data tm ON r.tmdb_id = tm.id
            LEFT JOIN record_tags tag ON r.id = tag.record_id
            WHERE EXISTS (
                SELECT 1
                FROM record_tags tag_filter
                WHERE tag_filter.record_id = r.id
                  AND tag_filter.tag_type = :tagType
            )
            GROUP BY
                r.id,
                r.name,
                r.type,
                tm.id,
                tm.release_date,
                tm.first_air_date,
                r.created_at,
                r.updated_at
            """,
            countQuery = """
                    SELECT COUNT(*)
                    FROM records r
                    WHERE EXISTS (
                        SELECT 1
                        FROM record_tags tag_filter
                        WHERE tag_filter.record_id = r.id
                          AND tag_filter.tag_type = :tagType
                    )
                    """,
            nativeQuery = true)
    Page<RecordAdminRowDto> findAdminTableByTag(
            @Param("tagType") String tagType,
            Pageable pageable
    );

    /* ================================================================
       MISC
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            ORDER BY tmdb.popularity DESC
            """)
    List<RecordEntity> findTopByPopularity(Pageable pageable);

    @Query("""
            SELECT r
            FROM RecordEntity r
            LEFT JOIN FETCH r.tmdb
            LEFT JOIN FETCH r.tags
            """)
    List<RecordEntity> findAllWithTmdbAndTags();

    @Query("""
            SELECT
                r.id as id,
                tmdb.title as title,
                r.type as type,
                tmdb.posterPath as posterPath,
                tmdb.backdropPath as backdropPath,
                tmdb.voteAverage as voteAverage,
                tmdb.popularity as popularity,
                COALESCE(
                    NULLIF(TRIM(tmdb.releaseDate), ''),
                    NULLIF(TRIM(tmdb.firstAirDate), '')
                ) as releaseDate,
                tmdb.overview as overview,
                tmdb.id as tmdbId,
                TREAT(tmdb as MovieTmdbEntity).runtime as runtime,
                TREAT(tmdb as TvSeriesTmdbEntity).numberOfSeasons as numberOfSeasons
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE r.id IN :ids
            """)
    List<RailRecordProjection> findRailRecordProjection(
            @Param("ids") Collection<Long> ids
    );

    List<RecordEntity> findByTmdbIdIn(Collection<Long> tmdbIds);

    /**
     * Used by the TMDB sync orchestrator.
     *
     * Filtering by RecordType is important because movies and TV series in TMDB
     * use independent numeric ID spaces. A movie #1930 and TV series #1930 are
     * unrelated. Without this filter, refreshing a movie can accidentally load
     * a TV record or vice versa.
     */
    List<RecordEntity> findByTmdbIdInAndType(Collection<Long> tmdbIds, RecordType type);
}