package com.db.dbworld.app.cinema.tmdb.people.service.impl;

import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.PersonTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService.PersonSyncReport;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.stream.LongStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Person detail backfill: a TMDB 404 is final, so the person is deleted rather than retried
 * every run, and a page full of failures must not spin the walk forever.
 */
@ExtendWith(MockitoExtension.class)
class PersonSyncServiceImplTest {

    @Mock PersonRepository personRepository;
    @Mock TmdbClient tmdbClient;
    @Mock TmdbIngestionService tmdbIngestionService;

    PersonSyncServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new PersonSyncServiceImpl(personRepository, tmdbClient, tmdbIngestionService);
    }

    private static PersonEntity person(long id) {
        var p = new PersonEntity();
        p.setId(id);
        p.setName("Person " + id);
        return p;
    }

    private static WebClientResponseException notFound() {
        return WebClientResponseException.create(404, "Not Found", HttpHeaders.EMPTY, new byte[0], null);
    }

    @Test
    void tmdb404DeletesThePersonSoItIsNotAskedForAgain() {
        when(personRepository.countByPersonSyncedFalse()).thenReturn(1L);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(0L), any(Limit.class)))
                .thenReturn(List.of(person(3936383L)));
        when(tmdbClient.getPerson(3936383L)).thenReturn(Mono.error(notFound()));

        PersonSyncReport report = service.syncUnsyncedPersons();

        verify(tmdbIngestionService).deletePerson(3936383L);
        verify(personRepository, never()).save(any());
        assertThat(report).isEqualTo(new PersonSyncReport(1, 0, 1, 0, false));
    }

    @Test
    void aFailedDeleteCountsAsFailedAndTheRunCarriesOn() {
        when(personRepository.countByPersonSyncedFalse()).thenReturn(2L);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(0L), any(Limit.class)))
                .thenReturn(List.of(person(1L), person(2L)));
        when(tmdbClient.getPerson(1L)).thenReturn(Mono.error(notFound()));
        doThrow(new IllegalStateException("db down")).when(tmdbIngestionService).deletePerson(1L);
        when(tmdbClient.getPerson(2L)).thenReturn(Mono.just(new PersonTmdbResponse()));

        PersonSyncReport report = service.syncUnsyncedPersons();

        assertThat(report).isEqualTo(new PersonSyncReport(2, 1, 0, 1, false));
    }

    @Test
    void aTransientFailureLeavesThePersonForTheNextRun() {
        PersonEntity flaky = person(42L);
        when(personRepository.countByPersonSyncedFalse()).thenReturn(1L);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(0L), any(Limit.class)))
                .thenReturn(List.of(flaky));
        when(tmdbClient.getPerson(42L)).thenReturn(Mono.error(new IllegalStateException("connection reset")));

        PersonSyncReport report = service.syncUnsyncedPersons();

        assertThat(flaky.isPersonSynced()).isFalse();
        verify(personRepository, never()).save(any());
        verify(tmdbIngestionService, never()).deletePerson(any());
        assertThat(report).isEqualTo(new PersonSyncReport(1, 0, 0, 1, false));
    }

    @Test
    void aSyncedPersonGetsItsDetails() {
        PersonEntity known = person(287L);
        var resp = new PersonTmdbResponse();
        resp.setBiography("bio");
        resp.setBirthday("1963-12-18");
        when(personRepository.countByPersonSyncedFalse()).thenReturn(1L);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(0L), any(Limit.class)))
                .thenReturn(List.of(known));
        when(tmdbClient.getPerson(287L)).thenReturn(Mono.just(resp));

        PersonSyncReport report = service.syncUnsyncedPersons();

        assertThat(known.isPersonSynced()).isTrue();
        assertThat(known.getBiography()).isEqualTo("bio");
        assertThat(known.getBirthday()).hasToString("1963-12-18");
        assertThat(report).isEqualTo(new PersonSyncReport(1, 1, 0, 0, false));
    }

    /**
     * The old loop re-read page 0 after every batch. Failures stay unsynced, so with a full
     * page of them and more rows behind it, page 0 came back identical forever.
     */
    @Test
    @Timeout(30)
    void aFullPageOfFailuresMovesOnInsteadOfLoopingForever() {
        List<PersonEntity> firstPage = LongStream.rangeClosed(1, 50).mapToObj(PersonSyncServiceImplTest::person).toList();
        PersonEntity behind = person(51L);
        when(personRepository.countByPersonSyncedFalse()).thenReturn(51L);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(0L), any(Limit.class)))
                .thenReturn(firstPage);
        when(personRepository.findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(eq(50L), any(Limit.class)))
                .thenReturn(List.of(behind));
        when(tmdbClient.getPerson(anyLong())).thenReturn(Mono.error(new IllegalStateException("TMDB down")));
        when(tmdbClient.getPerson(51L)).thenReturn(Mono.just(new PersonTmdbResponse()));

        PersonSyncReport report = service.syncUnsyncedPersons();

        assertThat(behind.isPersonSynced()).isTrue();
        assertThat(report).isEqualTo(new PersonSyncReport(51, 1, 0, 50, false));
    }
}
