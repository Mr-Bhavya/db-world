package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.entities.dbcinema.tmdb.GenresEntity;
import com.db.dbworld.entities.dbcinema.tmdb.TmdbDataEntity;
import com.db.dbworld.entities.dbcinema.user.UserRecordDataEntity;
import com.db.dbworld.payloads.RecordSearchCriteria;
import jakarta.persistence.criteria.*;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public class DBSpecifications {

    public static Specification<UserRecordDataEntity> findUserWatchListedRecords(Long userId) {
        return (root, query, criteriaBuilder) -> {
            // Join with DBCinemaRecordsEntity
            Join<UserRecordDataEntity, DBCinemaRecordsEntity> cinemaJoin = root.join("dbCinemaRecord");

            // Condition: URD.USER = :userId
            Predicate userCondition = criteriaBuilder.equal(root.get("user").get("id"), userId);

            // Condition: URD.isWatchListed = TRUE
            Predicate watchListCondition = criteriaBuilder.isTrue(root.get("isWatchListed"));

            // Sorting (ORDER BY URD.ID DESC)
            query.orderBy(criteriaBuilder.desc(root.get("id")));

            return criteriaBuilder.and(userCondition, watchListCondition);
        };
    }

    public static Specification<DBCinemaRecordsEntity> findRecord(RecordSearchCriteria recordSearchCriteria){
        return (dbCinemaRecordsEntityRoot, query, cb) -> {

            // To ensure distinct results when joining, you might want to add:
            query.distinct(true);

            List<Predicate> predicates = new ArrayList<>();

            // If recordType filter is provided, add condition.
            if (recordSearchCriteria.getRecordType() != null && !recordSearchCriteria.getRecordType().isBlank()) {
                predicates.add(cb.equal(dbCinemaRecordsEntityRoot.get("type"), recordSearchCriteria.getRecordType()));
            }

            // If languages filter is provided, add condition.
            if (recordSearchCriteria.getLanguages() != null && !recordSearchCriteria.getLanguages().isBlank()) {
                // Assuming your DBCinemaRecordsEntity has a relationship field "tmdbData"
                // that maps to the TmdbData entity.
                Join<DBCinemaRecordsEntity, TmdbDataEntity> tmdbJoin = dbCinemaRecordsEntityRoot.join("tmdb", JoinType.INNER);
                predicates.add(tmdbJoin.get("original_language").in(Arrays.stream(recordSearchCriteria.getLanguages().split(",")).toList()));
            }

            if (recordSearchCriteria.getGenres() != null && !recordSearchCriteria.getGenres().isBlank()) {

                // Join the 'tmdb' association from DBCinemaRecordsEntity.
                Join<DBCinemaRecordsEntity, TmdbDataEntity> tmdbJoin = getOrCreateJoin(dbCinemaRecordsEntityRoot, "tmdb");

                // Join the 'genres' collection within TmdbDataEntity.
                Join<TmdbDataEntity, GenresEntity> genresJoin = tmdbJoin.join("genres", JoinType.INNER);

                // Create a predicate filtering the genres by their IDs.
                // Convert the Integer[] to a List<Integer> if necessary.
                predicates.add(genresJoin.get("id").in(Arrays.stream(recordSearchCriteria.getGenres().split(",")).toList()));
            }

            if (recordSearchCriteria.getNameSearchQuery() != null && !recordSearchCriteria.getNameSearchQuery().isBlank()) {
                Join<DBCinemaRecordsEntity, TmdbDataEntity> tmdbJoin = dbCinemaRecordsEntityRoot.join("tmdb", JoinType.INNER);
                String searchQuery = "%" + recordSearchCriteria.getNameSearchQuery().toLowerCase() + "%";

                Predicate originalTitlePredicate = cb.like(cb.lower(tmdbJoin.get("original_title")), searchQuery);
                Predicate namePredicate = cb.like(cb.lower(dbCinemaRecordsEntityRoot.get("name")), searchQuery);

                predicates.add(cb.or(originalTitlePredicate, namePredicate));
            }

            // Apply ordering.
            // This mimics: order by (dcr.showOnTop = :showOnTop) desc, dcr.creationDate desc
            Expression<Boolean> showOnTopExpr = cb.equal(dbCinemaRecordsEntityRoot.get("showOnTop"), recordSearchCriteria.getShowOnTop());
            query.orderBy(
                    cb.desc(showOnTopExpr),
                    cb.desc(dbCinemaRecordsEntityRoot.get("creationDate"))
            );

            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Helper method to get or create a join. If a join on the given attribute already exists, it reuses it.
     */
    private static Join<DBCinemaRecordsEntity, TmdbDataEntity> getOrCreateJoin(Root<DBCinemaRecordsEntity> root, String attributeName) {
        Optional<Join<DBCinemaRecordsEntity, TmdbDataEntity>> existingJoin = root.getJoins().stream()
                .filter(j -> attributeName.equals(j.getAttribute().getName()))
                .map(j -> (Join<DBCinemaRecordsEntity, TmdbDataEntity>) j)
                .findFirst();
        return existingJoin.orElseGet(() -> root.join(attributeName, JoinType.INNER));
    }

}
