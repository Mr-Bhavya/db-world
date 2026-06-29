package com.db.dbworld.app.cinema.catalog.repository.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminFilter;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowView;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepositoryCustom;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.domain.SliceImpl;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class RecordRepositoryImpl implements RecordRepositoryCustom {

    private final EntityManager em;

    @Override
    public Page<RecordAdminRowDto> findAdminTable(
            RecordAdminFilter filter,
            Pageable pageable
    ) {

        CriteriaBuilder cb = em.getCriteriaBuilder();

        CriteriaQuery<RecordAdminRowDto> query =
                cb.createQuery(RecordAdminRowDto.class);

        Root<RecordEntity> record = query.from(RecordEntity.class);

        Join<RecordEntity, TmdbEntity> tmdb =
                record.join("tmdb", JoinType.LEFT);

        Join<RecordEntity, RecordTagEntity> tags =
                record.join("tags", JoinType.LEFT);

        List<Predicate> predicates = new ArrayList<>();

        if (filter.getRecordId() != null) {
            predicates.add(cb.equal(record.get("id"), filter.getRecordId()));
        }

        if (filter.getName() != null) {
            predicates.add(cb.like(
                    cb.lower(record.get("name")),
                    "%" + filter.getName().toLowerCase() + "%"
            ));
        }

        if (filter.getType() != null) {
            predicates.add(cb.equal(record.get("type"), filter.getType()));
        }

        if (filter.getTmdbId() != null) {
            predicates.add(cb.equal(tmdb.get("id"), filter.getTmdbId()));
        }

        if (filter.getYear() != null) {
            predicates.add(cb.equal(tmdb.get("year"), filter.getYear()));
        }

        query.select(cb.construct(
                RecordAdminRowDto.class,
                record.get("id"),
                record.get("name"),
                record.get("type"),
                tmdb.get("id"),
                tmdb.get("year"),
                record.get("createdAt"),
                record.get("updatedAt"),
                cb.function("STRING_AGG",
                        String.class,
                        tags.get("tagType"),
                        cb.literal(",")),
                record.get("hideFromRails")
        ));

        query.where(predicates.toArray(new Predicate[0]));

        query.groupBy(
                record.get("id"),
                record.get("name"),
                record.get("type"),
                tmdb.get("id"),
                tmdb.get("year"),
                record.get("createdAt"),
                record.get("updatedAt"),
                record.get("hideFromRails")
        );

        TypedQuery<RecordAdminRowDto> typedQuery = em.createQuery(query);

        typedQuery.setFirstResult((int) pageable.getOffset());
        typedQuery.setMaxResults(pageable.getPageSize());

        List<RecordAdminRowDto> content = typedQuery.getResultList();

        return new PageImpl<>(content, pageable, content.size());
    }

    /* =========================================================
       ADMIN TABLE — hand-built native query

       Sorting is applied from a safe allowlist (ADMIN_SORT) so it can target
       joined/computed columns (sync state, tmdb year). Spring Data's native
       @Query sort can't: it prefixes the primary alias `r.` onto every sort
       column, which breaks for `s.*` and the computed year. Tags / media rollups
       are correlated subqueries, so no GROUP BY is needed (the tm/s joins are 1:1).
       ========================================================= */

    private static final String ADMIN_SELECT = """
            SELECT
                r.id AS recordId,
                r.name AS name,
                r.type AS type,
                tm.id AS tmdbId,
                YEAR(COALESCE(NULLIF(TRIM(tm.release_date), ''), NULLIF(TRIM(tm.first_air_date), ''))) AS year,
                r.created_at AS createdAt,
                r.updated_at AS updatedAt,
                r.hide_from_rails AS hideFromRails,
                (SELECT GROUP_CONCAT(t.tag_type ORDER BY t.priority SEPARATOR ',')
                   FROM record_tags t WHERE t.record_id = r.id) AS tags,
                s.status AS syncStatus,
                s.last_synced_at AS lastSyncedAt,
                s.last_checked_at AS lastCheckedAt,
                s.error_message AS syncError,
                (SELECT COUNT(*) FROM media_files mf WHERE mf.record_id = r.id) AS mediaFileCount,
                (SELECT CAST(COALESCE(SUM(mf.file_size), 0) AS UNSIGNED)
                   FROM media_files mf WHERE mf.record_id = r.id) AS mediaTotalSize
            """;

    private static final Map<String, String> ADMIN_SORT = Map.of(
            "recordId",      "r.id",
            "name",          "r.name",
            "type",          "r.type",
            "tmdbId",        "tm.id",
            "year",          "YEAR(COALESCE(NULLIF(TRIM(tm.release_date), ''), NULLIF(TRIM(tm.first_air_date), '')))",
            "createdAt",     "r.created_at",
            "updatedAt",     "r.updated_at",
            "lastSyncedAt",  "s.last_synced_at",
            "lastCheckedAt", "s.last_checked_at"
    );

    @Override
    public Page<RecordAdminRowDto> findAdminTable(
            Long recordId, String name, String type, Long tmdbId, Integer year, String status, Pageable pageable) {

        boolean hasName = name != null && !name.isBlank();

        // Join EXACTLY ONE sync row per record (the latest), matched by the sync
        // table's logical key (tmdb_id + record_type). Joining on s.record_id was
        // wrong (it's self-healed onto both movie+TV sync rows that share a tmdb id);
        // even matching on (tmdb_id, record_type) can multiply if duplicate sync rows
        // exist (no DB unique constraint). Picking the single latest row by PK makes
        // the result one row per record — no duplicate recordId, no GROUP BY needed.
        StringBuilder where = new StringBuilder("""
                FROM records r
                LEFT JOIN tmdb_data tm ON r.tmdb_id = tm.id
                LEFT JOIN tmdb_record_sync s ON s.id = (
                    SELECT s2.id FROM tmdb_record_sync s2
                    WHERE s2.tmdb_id = r.tmdb_id AND s2.record_type = r.type
                    ORDER BY s2.last_checked_at DESC, s2.id DESC
                    LIMIT 1
                )
                WHERE 1 = 1
                """);
        if (recordId != null) where.append(" AND r.id = :recordId");
        if (hasName)          where.append(" AND LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%'))");
        if (type != null)     where.append(" AND r.type = :type");
        if (tmdbId != null)   where.append(" AND tm.id = :tmdbId");
        if (status != null)   where.append(" AND s.status = :status");
        if (year != null)     where.append(" AND YEAR(COALESCE(NULLIF(TRIM(tm.release_date), ''), NULLIF(TRIM(tm.first_air_date), ''))) = :year");

        String fromWhere = where.toString();

        Query dataQuery = em.createNativeQuery(ADMIN_SELECT + fromWhere + buildAdminOrderBy(pageable));
        bindAdminParams(dataQuery, recordId, hasName ? name : null, type, tmdbId, year, status);
        dataQuery.setFirstResult((int) pageable.getOffset());
        dataQuery.setMaxResults(pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<Object[]> rows = dataQuery.getResultList();
        List<RecordAdminRowDto> content = rows.stream()
                .map(RecordRepositoryImpl::mapAdminRow)
                .collect(Collectors.toList());

        Query countQuery = em.createNativeQuery("SELECT COUNT(*) " + fromWhere);
        bindAdminParams(countQuery, recordId, hasName ? name : null, type, tmdbId, year, status);
        long total = ((Number) countQuery.getSingleResult()).longValue();

        return new PageImpl<>(content, pageable, total);
    }

    private static String buildAdminOrderBy(Pageable pageable) {
        if (pageable.getSort().isUnsorted()) {
            return " ORDER BY r.id DESC";
        }
        List<String> parts = new ArrayList<>();
        for (Sort.Order o : pageable.getSort()) {
            String expr = ADMIN_SORT.get(o.getProperty());
            if (expr != null) {
                parts.add(expr + (o.isAscending() ? " ASC" : " DESC"));
            }
        }
        return parts.isEmpty() ? " ORDER BY r.id DESC" : " ORDER BY " + String.join(", ", parts);
    }

    private static void bindAdminParams(Query q, Long recordId, String name, String type,
                                        Long tmdbId, Integer year, String status) {
        if (recordId != null) q.setParameter("recordId", recordId);
        if (name != null)     q.setParameter("name", name);
        if (type != null)     q.setParameter("type", type);
        if (tmdbId != null)   q.setParameter("tmdbId", tmdbId);
        if (status != null)   q.setParameter("status", status);
        if (year != null)     q.setParameter("year", year);
    }

    private static RecordAdminRowDto mapAdminRow(Object[] r) {
        return new RecordAdminRowView(
                toLong(r[0]),
                (String) r[1],
                r[2] == null ? null : RecordType.valueOf((String) r[2]),
                toLong(r[3]),
                toInteger(r[4]),
                toInstant(r[5]),
                toInstant(r[6]),
                toBoolean(r[7]),
                (String) r[8],
                (String) r[9],
                toInstant(r[10]),
                toInstant(r[11]),
                (String) r[12],
                toLong(r[13]),
                toLong(r[14])
        );
    }

    private static Long toLong(Object o)      { return o == null ? null : ((Number) o).longValue(); }
    private static Integer toInteger(Object o) { return o == null ? null : ((Number) o).intValue(); }

    private static Boolean toBoolean(Object o) {
        if (o == null) return null;
        if (o instanceof Boolean b) return b;
        return ((Number) o).intValue() != 0;
    }

    private static Instant toInstant(Object o) {
        if (o == null) return null;
        if (o instanceof Timestamp ts) return ts.toInstant();
        if (o instanceof Instant i) return i;
        if (o instanceof java.time.LocalDateTime ldt) return ldt.atZone(java.time.ZoneId.systemDefault()).toInstant();
        return null;
    }

    @Override
    public Slice<Long> findIdsBySpecification(Specification<RecordEntity> spec, Pageable pageable) {

        CriteriaBuilder cb = em.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<RecordEntity> root = query.from(RecordEntity.class);

        query.select(root.get("id"));

        // Apply specification predicates first (may create joins)
        if (spec != null) {
            Predicate predicate = spec.toPredicate(root, query, cb);
            if (predicate != null) {
                query.where(predicate);
            }
        }

        // Ensure tmdb join exists for sorting (reuse if spec already created it)
        ensureJoin(root, "tmdb");

        // Apply sorting — resolve "tmdb.xxx" to the join path
        if (pageable.getSort().isSorted()) {
            List<Order> orders = new ArrayList<>();
            for (Sort.Order sortOrder : pageable.getSort()) {
                Path<?> path = resolvePath(root, sortOrder.getProperty());
                orders.add(sortOrder.isAscending()
                        ? cb.asc(path)
                        : cb.desc(path));
            }
            query.orderBy(orders);
        }

        TypedQuery<Long> typedQuery = em.createQuery(query);
        typedQuery.setFirstResult((int) pageable.getOffset());
        // Fetch one extra to determine hasNext
        typedQuery.setMaxResults(pageable.getPageSize() + 1);

        List<Long> results = typedQuery.getResultList();

        boolean hasNext = results.size() > pageable.getPageSize();
        if (hasNext) {
            results = results.subList(0, pageable.getPageSize());
        }

        return new SliceImpl<>(results, pageable, hasNext);
    }

    /**
     * Ensures a join exists for the given attribute, reusing if already present.
     */
    private void ensureJoin(Root<?> root, String attribute) {
        for (Join<?, ?> join : root.getJoins()) {
            if (join.getAttribute().getName().equals(attribute)) {
                return; // already joined
            }
        }
        root.join(attribute, JoinType.INNER);
    }

    /**
     * Resolves dot-notation paths like "tmdb.popularity" to JPA Path objects.
     * Reuses existing joins (e.g., the "tmdb" join we created above).
     */
    private Path<?> resolvePath(Root<?> root, String property) {

        String[] parts = property.split("\\.");
        Path<?> path = root;

        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];

            // For the first segment, try to reuse an existing join
            if (i == 0 && path instanceof Root<?> r) {
                Join<?, ?> existingJoin = null;
                for (Join<?, ?> join : r.getJoins()) {
                    if (join.getAttribute().getName().equals(part)) {
                        existingJoin = join;
                        break;
                    }
                }
                if (existingJoin != null) {
                    path = existingJoin;
                    continue;
                }
            }

            path = path.get(part);
        }

        return path;
    }
}
