package com.db.dbworld.app.cinema.catalog.repository;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.rail.projection.RailRecordProjection;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface RecordRepository extends JpaRepository<RecordEntity, Long>,
        JpaSpecificationExecutor<RecordEntity>,
        RecordRepositoryCustom {

    Optional<RecordEntity> findByTmdb_Id(Long tmdbId);

    List<RecordEntity> findByType(RecordType type);

    /** Dashboard: count records by type (MOVIE / SERIES). */
    long countByType(RecordType type);

    boolean existsByTmdb_Id(Long tmdbId);

    Optional<RecordEntity> findById(Long id);

    @Query("""
            SELECT r
            FROM RecordEntity r
            LEFT JOIN FETCH r.tmdb
            WHERE r.id = :id
            """)
    Optional<RecordEntity> findByIdWithTmdb(Long id);

    /* ================================================================
       TAG RAILS
       All tag queries JOIN tmdb so sort on tmdb.* fields works.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tags t
            JOIN r.tmdb tmdb
            WHERE t.tagType = :tag
            """)
    Slice<RecordEntity> findByTag(RecordTagType tag, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags t
            JOIN r.tmdb tmdb
            WHERE t.tagType = :tag
            """)
    Slice<Long> findIdsByTag(RecordTagType tag, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags t
            JOIN r.tmdb tmdb
            WHERE t.tagType = :tag
            AND r.type = :recordType
            """)
    Slice<Long> findIdsByTagAndType(RecordTagType tag, RecordType recordType, Pageable pageable);

    /* ================================================================
       GENRE RAILS
       Already JOINs tmdb via tm.genres — alias as tmdb for sort.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g
            WHERE g.id = :genreId
            """)
    Slice<RecordEntity> findByGenre(Long genreId, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g
            WHERE g.id = :genreId
            """)
    Slice<Long> findIdsByGenre(Long genreId, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g
            WHERE g.id = :genreId
            AND r.type = :recordType
            """)
    Slice<Long> findIdsByGenreAndType(Long genreId, RecordType recordType, Pageable pageable);

    /* ================================================================
       LANGUAGE RAILS
       Alias tmdb join as "tmdb" for sort compatibility.
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
            """)
    Slice<RecordEntity> findByLanguages(List<String> languages, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
            """)
    Slice<Long> findIdsByLanguages(List<String> languages, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            WHERE tmdb.originalLanguage IN :languages
            AND r.type = :recordType
            """)
    Slice<Long> findIdsByLanguagesAndType(List<String> languages, RecordType recordType, Pageable pageable);

    /* ================================================================
       CATEGORY (GENRE) FILTERED VARIANTS
       Used when user selects a genre/category on the page.
       Adds AND g2.id = :category to every rail query.
    ================================================================= */

    // Tag + Category
    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags t
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g2
            WHERE t.tagType = :tag
            AND g2.id = :category
            """)
    Slice<Long> findIdsByTagAndCategory(RecordTagType tag, Long category, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tags t
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g2
            WHERE t.tagType = :tag
            AND r.type = :recordType
            AND g2.id = :category
            """)
    Slice<Long> findIdsByTagAndTypeAndCategory(RecordTagType tag, RecordType recordType, Long category, Pageable pageable);

    // Genre + Category (category IS the genre, so same as existing genre query)
    // No extra method needed — findIdsByGenre / findIdsByGenreAndType already filter by genre.

    // Language + Category
    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g2
            WHERE tmdb.originalLanguage IN :languages
            AND g2.id = :category
            """)
    Slice<Long> findIdsByLanguagesAndCategory(List<String> languages, Long category, Pageable pageable);

    @Query("""
            SELECT r.id
            FROM RecordEntity r
            JOIN r.tmdb tmdb
            JOIN tmdb.genres g2
            WHERE tmdb.originalLanguage IN :languages
            AND r.type = :recordType
            AND g2.id = :category
            """)
    Slice<Long> findIdsByLanguagesAndTypeAndCategory(List<String> languages, RecordType recordType, Long category, Pageable pageable);

    /*
     * findIdsBySpecification is implemented in RecordRepositoryImpl (custom repo).
     * Do NOT add a @Query version here — @Query ignores Specification.
     */

    /* ================================================================
       SEARCH
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb tm
            WHERE LOWER(tm.originalTitle) LIKE LOWER(CONCAT('%', :query, '%'))
            OR LOWER(tm.title) LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    Page<RecordEntity> search(String query, Pageable pageable);

    @Query("""
            SELECT r.id           as id,
                   tm.title       as title,
                   r.type         as type,
                   tm.posterPath  as posterPath,
                   tm.backdropPath as backdropPath,
                   tm.voteAverage as voteAverage,
                   tm.popularity  as popularity,
                   COALESCE(tm.releaseDate, tm.firstAirDate) as releaseDate,
                   tm.overview    as overview,
                   tm.id          as tmdbId
            FROM RecordEntity r
            JOIN r.tmdb tm
            WHERE LOWER(tm.originalTitle) LIKE LOWER(CONCAT('%', :query, '%'))
               OR LOWER(tm.title)         LIKE LOWER(CONCAT('%', :query, '%'))
            """)
    Page<RailRecordProjection> searchProjection(String query, Pageable pageable);

    @Query("""
            SELECT new com.db.dbworld.app.cinema.catalog.dto.RecordAutocompleteDto(
                r.id,
                r.name,
                r.type,
                tm.id,
                tm.posterPath
            )
            FROM RecordEntity r
            JOIN r.tmdb tm
            WHERE LOWER(tm.originalTitle) LIKE LOWER(CONCAT(:query, '%'))
               OR LOWER(tm.title) LIKE LOWER(CONCAT(:query, '%'))
            ORDER BY r.createdAt desc
            """)
    Page<RecordAutocompleteDto> autocomplete(String query, Pageable pageable);

    /* ================================================================
       ADMIN TABLE
    ================================================================= */

    @Query(value = """
            SELECT
                r.id AS recordId,
                r.name AS name,
                r.type AS type,
                tm.id AS tmdbId,

                YEAR(COALESCE(tm.release_date, tm.first_air_date)) AS year,

                r.created_at AS createdAt,
                r.updated_at AS updatedAt,
                GROUP_CONCAT(t.tag_type ORDER BY t.priority SEPARATOR ',') AS tags

            FROM records r
            LEFT JOIN tmdb_data tm ON r.tmdb_id = tm.id
            LEFT JOIN record_tags t ON r.id = t.record_id

            WHERE
                (:recordId IS NULL OR r.id = :recordId)
            AND (:name IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%')))
            AND (:type IS NULL OR r.type = :type)
            AND (:tmdbId IS NULL OR tm.id = :tmdbId)
            AND (:year IS NULL OR YEAR(COALESCE(tm.release_date, tm.first_air_date)) = :year)

            GROUP BY r.id
            """,
            countQuery = """
                    SELECT COUNT(DISTINCT r.id)

                    FROM records r
                    LEFT JOIN tmdb_data tm ON r.tmdb_id = tm.id

                    WHERE
                        (:recordId IS NULL OR r.id = :recordId)
                    AND (:name IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%')))
                    AND (:type IS NULL OR r.type = :type)
                    AND (:tmdbId IS NULL OR tm.id = :tmdbId)
                    AND (:year IS NULL OR YEAR(COALESCE(tm.release_date, tm.first_air_date)) = :year)
                    """,
            nativeQuery = true)
    Page<RecordAdminRowDto> findAdminTable(
            Long recordId,
            String name,
            RecordType type,
            Long tmdbId,
            Integer year,
            Pageable pageable
    );

    /* ================================================================
       TAG ADMIN — paginated admin table rows filtered by a single tag
    ================================================================= */

    @Query(value = """
            SELECT
                r.id AS recordId,
                r.name AS name,
                r.type AS type,
                tm.id AS tmdbId,
                YEAR(COALESCE(tm.release_date, tm.first_air_date)) AS year,
                r.created_at AS createdAt,
                r.updated_at AS updatedAt,
                GROUP_CONCAT(t.tag_type ORDER BY t.priority SEPARATOR ',') AS tags
            FROM records r
            LEFT JOIN tmdb_data tm ON r.tmdb_id = tm.id
            LEFT JOIN record_tags t ON r.id = t.record_id
            WHERE EXISTS (
                SELECT 1 FROM record_tags tt
                WHERE tt.record_id = r.id AND tt.tag_type = :tagType
            )
            GROUP BY r.id
            """,
            countQuery = """
                    SELECT COUNT(DISTINCT r.id)
                    FROM records r
                    INNER JOIN record_tags tt ON tt.record_id = r.id AND tt.tag_type = :tagType
                    """,
            nativeQuery = true)
    Page<RecordAdminRowDto> findAdminTableByTag(
            @org.springframework.data.repository.query.Param("tagType") String tagType,
            Pageable pageable
    );

    /* ================================================================
       MISC
    ================================================================= */

    @Query("""
            SELECT r
            FROM RecordEntity r
            JOIN r.tmdb t
            ORDER BY t.popularity DESC
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
                t.title as title,
                r.type as type,
                t.posterPath as posterPath,
                t.backdropPath as backdropPath,
                t.voteAverage as voteAverage,
                t.popularity as popularity,
                COALESCE(t.releaseDate, t.firstAirDate) as releaseDate,
                t.overview as overview,
                t.id as tmdbId
            FROM RecordEntity r
            JOIN r.tmdb t
            WHERE r.id IN :ids
            """)
    List<RailRecordProjection> findRailRecordProjection(List<Long> ids);

    List<RecordEntity> findByTmdbIdIn(List<Long> tmdbIds);
}
