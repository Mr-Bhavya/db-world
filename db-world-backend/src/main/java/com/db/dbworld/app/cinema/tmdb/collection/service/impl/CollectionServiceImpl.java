package com.db.dbworld.app.cinema.tmdb.collection.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.CollectionDetailTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.CollectionPartTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDetailDto;
import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionPartDto;
import com.db.dbworld.app.cinema.tmdb.collection.service.CollectionService;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.hibernate.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class CollectionServiceImpl implements CollectionService {

    private final TmdbClient tmdbClient;
    private final RecordRepository recordRepository;
    private final EntityManager entityManager;

    @Override
    @Transactional(readOnly = true)
    public CollectionDetailDto getCollection(Long collectionId) {
        // The members of a collection only exist on /collection/{id}; the
        // belongs_to_collection block on a movie carries the collection's identity
        // and nothing else.
        CollectionDetailTmdbResponse tmdb = tmdbClient.getCollection(collectionId).block();
        if (tmdb == null || tmdb.getId() == null) {
            throw new EntityNotFoundException("Collection not found: " + collectionId);
        }

        List<CollectionPartTmdbResponse> parts = tmdb.getParts() == null ? List.of() : tmdb.getParts();

        // A part is a direct link to one specific known title rather than a rails
        // recommendation, so UNLISTED still counts as owned — the same rule the
        // record detail page itself applies.
        entityManager.unwrap(Session.class).enableFilter("publicVisible");

        Set<Long> tmdbIds = parts.stream()
                .map(CollectionPartTmdbResponse::getId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Movies and series have independent TMDB id spaces, so the type filter is
        // what stops a series sharing a part's number from being matched.
        Map<Long, RecordEntity> owned = tmdbIds.isEmpty()
                ? Map.of()
                : recordRepository.findByTmdbIdInAndType(tmdbIds, RecordType.MOVIE).stream()
                        .collect(Collectors.toMap(RecordEntity::getTmdbId, Function.identity(), (a, b) -> a));

        List<CollectionPartDto> mapped = parts.stream()
                .filter(p -> p.getId() != null)
                .map(p -> toPart(p, owned.get(p.getId())))
                // TMDB returns parts in no meaningful order; the rail is numbered, so
                // it has to be release order.
                .sorted(Comparator.comparing(CollectionPartDto::releaseDate,
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        int ownedCount = (int) mapped.stream().filter(CollectionPartDto::available).count();

        return new CollectionDetailDto(
                tmdb.getId(),
                tmdb.getName(),
                tmdb.getOverview(),
                tmdb.getPoster_path(),
                tmdb.getBackdrop_path(),
                mapped,
                ownedCount
        );
    }

    private static CollectionPartDto toPart(CollectionPartTmdbResponse part, RecordEntity record) {
        return new CollectionPartDto(
                part.getId(),
                part.getTitle(),
                part.getOverview(),
                part.getPoster_path(),
                part.getBackdrop_path(),
                part.getRelease_date(),
                part.getVote_average(),
                record == null ? null : record.getId(),
                record == null ? null : slugFor(record)
        );
    }

    /** Matches the {id}-{kebab-name} slug the cinema routes are built from. */
    private static String slugFor(RecordEntity record) {
        String name = record.getName();
        String slug = name == null ? ""
                : name.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return slug.isBlank() ? String.valueOf(record.getId()) : record.getId() + "-" + slug;
    }
}
