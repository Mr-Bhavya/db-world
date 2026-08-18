package com.db.dbworld.app.cinema.tmdb.collection.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.CollectionDetailTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.client.dto.CollectionPartTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDetailDto;
import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionPartDto;

import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import org.hibernate.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Collection assembly: the library-availability join, release ordering and the
 * owned count the completion meter is drawn from.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CollectionServiceImplTest {

    @Mock TmdbClient tmdbClient;
    @Mock RecordRepository recordRepository;
    @Mock EntityManager entityManager;
    @Mock Session session;

    CollectionServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CollectionServiceImpl(tmdbClient, recordRepository, entityManager);
        when(entityManager.unwrap(Session.class)).thenReturn(session);
    }

    private static CollectionPartTmdbResponse part(long id, String title, String releaseDate) {
        var p = new CollectionPartTmdbResponse();
        p.setId(id);
        p.setTitle(title);
        p.setRelease_date(releaseDate);
        return p;
    }

    private static RecordEntity record(long recordId, long tmdbId, String name) {
        var r = mock(RecordEntity.class);
        when(r.getId()).thenReturn(recordId);
        when(r.getTmdbId()).thenReturn(tmdbId);
        when(r.getName()).thenReturn(name);
        return r;
    }

    private void givenTmdbCollection(CollectionPartTmdbResponse... parts) {
        var response = new CollectionDetailTmdbResponse();
        response.setId(263L);
        response.setName("The Dark Knight Collection");
        response.setParts(List.of(parts));
        when(tmdbClient.getCollection(263L)).thenReturn(Mono.just(response));
    }

    @Test
    void marksPartsHeldInTheLibraryAndLeavesTheRestRequestable() {
        givenTmdbCollection(
                part(272L, "Batman Begins", "2005-06-10"),
                part(155L, "The Dark Knight", "2008-07-16"),
                part(49026L, "The Dark Knight Rises", "2012-07-16"));

        // Built before the stub: Mockito rejects stubbing one mock inside another
        // mock's unfinished thenReturn(...).
        var batmanBegins = record(9L, 272L, "Batman Begins");
        when(recordRepository.findByTmdbIdInAndType(any(), eq(RecordType.MOVIE)))
                .thenReturn(List.of(batmanBegins));

        CollectionDetailDto result = service.getCollection(263L);

        assertThat(result.ownedCount()).isEqualTo(1);
        assertThat(result.parts()).extracting(CollectionPartDto::tmdbId, CollectionPartDto::recordId)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(272L, 9L),
                        org.assertj.core.groups.Tuple.tuple(155L, null),
                        org.assertj.core.groups.Tuple.tuple(49026L, null));
    }

    @Test
    void ordersPartsByReleaseDateRegardlessOfTmdbOrder() {
        givenTmdbCollection(
                part(49026L, "The Dark Knight Rises", "2012-07-16"),
                part(272L, "Batman Begins", "2005-06-10"),
                part(155L, "The Dark Knight", "2008-07-16"));

        when(recordRepository.findByTmdbIdInAndType(any(), eq(RecordType.MOVIE))).thenReturn(List.of());

        assertThat(service.getCollection(263L).parts())
                .extracting(CollectionPartDto::title)
                .containsExactly("Batman Begins", "The Dark Knight", "The Dark Knight Rises");
    }

    @Test
    void sortsUndatedPartsLastRatherThanFailing() {
        givenTmdbCollection(
                part(1L, "Untitled Sequel", null),
                part(2L, "First Film", "2001-01-01"));

        when(recordRepository.findByTmdbIdInAndType(any(), eq(RecordType.MOVIE))).thenReturn(List.of());

        assertThat(service.getCollection(263L).parts())
                .extracting(CollectionPartDto::title)
                .containsExactly("First Film", "Untitled Sequel");
    }

    @Test
    void buildsTheSlugTheCinemaRoutesExpect() {
        givenTmdbCollection(part(272L, "Batman Begins", "2005-06-10"));
        var messyName = record(9L, 272L, "Batman Begins: The Beginning!");
        when(recordRepository.findByTmdbIdInAndType(any(), eq(RecordType.MOVIE)))
                .thenReturn(List.of(messyName));

        assertThat(service.getCollection(263L).parts().getFirst().recordSlug())
                .isEqualTo("9-batman-begins-the-beginning");
    }

    @Test
    void skipsTheLibraryLookupWhenTheCollectionHasNoParts() {
        var response = new CollectionDetailTmdbResponse();
        response.setId(263L);
        response.setName("Empty");
        when(tmdbClient.getCollection(263L)).thenReturn(Mono.just(response));

        CollectionDetailDto result = service.getCollection(263L);

        assertThat(result.parts()).isEmpty();
        assertThat(result.ownedCount()).isZero();
    }

    @Test
    void reportsAnUnknownCollectionAsNotFound() {
        when(tmdbClient.getCollection(999L)).thenReturn(Mono.empty());

        assertThatThrownBy(() -> service.getCollection(999L))
                .isInstanceOf(EntityNotFoundException.class)
                .hasMessageContaining("999");
    }
}
