package com.db.dbworld.app.cinema.catalog.specification;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminFilter;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordType;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

public class RecordSpecification {

    public static Specification<RecordEntity> hasType(RecordType type) {
        return (root, query, cb) -> cb.equal(root.get("type"), type);
    }

    /**
     * Category filter: record's tmdb must have the given genre.
     */
    public static Specification<RecordEntity> hasGenre(Long genreId) {
        return (root, query, cb) -> {
            Join<Object, Object> tmdb = root.join("tmdb");
            Join<Object, Object> genres = tmdb.join("genres");
            return cb.equal(genres.get("id"), genreId);
        };
    }

    /**
     * Dynamic filter for rail rules.
     * Supports both legacy field names and direct tmdb field names.
     */
    public static Specification<RecordEntity> filter(String field, Object value) {

        return (root, query, cb) -> {

            if (field == null || value == null) {
                return cb.conjunction(); // no filter, return all
            }

            Join<Object, Object> tmdb = root.join("tmdb");

            return switch (field) {

                // Direct tmdb field filters (used by RailBootstrapService)
                case "voteAverage" -> cb.greaterThanOrEqualTo(
                        tmdb.get("voteAverage"),
                        ((Number) value).doubleValue()
                );

                case "popularity" -> cb.greaterThanOrEqualTo(
                        tmdb.get("popularity"),
                        ((Number) value).doubleValue()
                );

                case "voteCount" -> cb.greaterThanOrEqualTo(
                        tmdb.get("voteCount"),
                        ((Number) value).intValue()
                );

                // Legacy field names (backward compatibility)
                case "rating_gt" -> cb.greaterThan(
                        tmdb.get("voteAverage"),
                        ((Number) value).doubleValue()
                );

                case "runtime_gt" -> cb.greaterThan(
                        tmdb.get("runtime"),
                        ((Number) value).intValue()
                );

                case "downloadable" -> cb.equal(
                        root.get("downloadable"), value
                );

                default -> cb.conjunction();
            };
        };
    }

    public static Specification<RecordEntity> filter(RecordAdminFilter filter) {

        return (root, query, cb) -> {

            Predicate predicate = cb.conjunction();

            if (filter.getRecordId() != null) {
                predicate = cb.and(predicate,
                        cb.equal(root.get("id"), filter.getRecordId()));
            }

            if (filter.getName() != null) {
                predicate = cb.and(predicate,
                        cb.like(cb.lower(root.get("name")),
                                "%" + filter.getName().toLowerCase() + "%"));
            }

            if (filter.getType() != null) {
                predicate = cb.and(predicate,
                        cb.equal(root.get("type"), filter.getType()));
            }

            if (filter.getTmdbId() != null) {
                predicate = cb.and(predicate,
                        cb.equal(root.get("tmdb").get("id"), filter.getTmdbId()));
            }

            if (filter.getYear() != null) {
                predicate = cb.and(predicate,
                        cb.equal(root.get("tmdb").get("year"), filter.getYear()));
            }

            return predicate;
        };
    }
}
