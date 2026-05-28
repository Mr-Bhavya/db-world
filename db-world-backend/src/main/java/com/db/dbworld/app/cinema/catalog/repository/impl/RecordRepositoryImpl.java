package com.db.dbworld.app.cinema.catalog.repository.impl;

import com.db.dbworld.app.cinema.catalog.dto.RecordAdminFilter;
import com.db.dbworld.app.cinema.catalog.dto.RecordAdminRowDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.entities.RecordTagEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepositoryCustom;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import jakarta.persistence.EntityManager;
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

import java.util.ArrayList;
import java.util.List;

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
