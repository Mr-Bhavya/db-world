package com.db.dbworld.app.cinema.tmdb.people.service.impl;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.PersonTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.ingestion.TmdbIngestionService;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.LocalDate;
import java.util.List;

@Log4j2
@Service
@RequiredArgsConstructor
public class PersonSyncServiceImpl implements PersonSyncService {

    private static final int BATCH_SIZE = 50;

    private final PersonRepository     personRepository;
    private final TmdbClient           tmdbClient;
    private final TmdbIngestionService tmdbIngestionService;

    private enum Outcome { SYNCED, GONE }

    @Override
    public PersonSyncReport syncUnsyncedPersons(ProgressListener onProgress) {

        long total   = personRepository.countByPersonSyncedFalse();
        long synced  = 0;
        long gone    = 0;
        long failed  = 0;
        long afterId = 0;
        int  batchNo = 0;

        log.info("PersonSync starting — {} persons need full detail fetch", total);

        while (true) {
            // Keyset, not "page 0 again": a person whose fetch fails stays unsynced, so once a
            // full page of failures piled up at the front, re-reading page 0 handed the same
            // rows back forever. Walking past the last id tries each person once per run.
            List<PersonEntity> persons = personRepository
                    .findByPersonSyncedFalseAndIdGreaterThanOrderByIdAsc(afterId, Limit.of(BATCH_SIZE));

            if (persons.isEmpty()) break;

            log.info("PersonSync batch {} — {} persons", batchNo++, persons.size());

            for (PersonEntity person : persons) {
                afterId = person.getId();
                try {
                    switch (syncOne(person)) {
                        case SYNCED -> synced++;
                        case GONE   -> gone++;
                    }
                } catch (Exception e) {
                    log.warn("PersonSync failed for id={}: {}", person.getId(), e.getMessage());
                    failed++;
                }
                onProgress.onProgress(synced, gone, failed);

                // Rate-limit: stay within TMDB's ~50 requests/sec free-tier guideline
                try { Thread.sleep(TmdbSync.DELAY_MS); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("PersonSync interrupted after synced={}, gone={}, failed={}", synced, gone, failed);
                    return new PersonSyncReport(total, synced, gone, failed, true);
                }
            }

            if (persons.size() < BATCH_SIZE) break;
        }

        log.info("PersonSync complete — synced={}, gone={}, failed={}", synced, gone, failed);
        return new PersonSyncReport(total, synced, gone, failed, false);
    }

    private Outcome syncOne(PersonEntity person) {
        PersonTmdbResponse resp;
        try {
            resp = tmdbClient.getPerson(person.getId()).block();
        } catch (WebClientResponseException.NotFound e) {
            // TMDB deletes duplicate and spam profiles while our credits still hold the old id.
            // That is final, so drop the person (and their credits) instead of asking every run.
            log.info("PersonSync: id={} ({}) no longer exists on TMDB; deleting it",
                    person.getId(), person.getName());
            tmdbIngestionService.deletePerson(person.getId());
            return Outcome.GONE;
        }
        // An empty 200 is a failed fetch: left unsynced for the next run, and counted, so the
        // run's numbers add up to the persons it reached.
        if (resp == null) throw new IllegalStateException("TMDB returned an empty body");

        applyDetails(person, resp);
        person.setPersonSynced(true);
        personRepository.save(person);
        return Outcome.SYNCED;
    }

    @Override
    public long countUnsynced() {
        return personRepository.countByPersonSyncedFalse();
    }

    // ── Apply full TMDB detail onto the entity ────────────────────────────────

    private void applyDetails(PersonEntity p, PersonTmdbResponse r) {
        if (r.getBiography()            != null) p.setBiography(r.getBiography());
        if (r.getBirthday()             != null) p.setBirthday(parseDate(r.getBirthday()));
        if (r.getDeathday()             != null) p.setDeathday(parseDate(r.getDeathday()));
        if (r.getPlace_of_birth()       != null) p.setPlaceOfBirth(r.getPlace_of_birth());
        if (r.getImdb_id()              != null) p.setImdbId(r.getImdb_id());
        if (r.getHomepage()             != null) p.setHomepage(r.getHomepage());
        if (r.getProfile_path()         != null) p.setProfilePath(r.getProfile_path());
        if (r.getKnown_for_department() != null) p.setKnownForDepartment(r.getKnown_for_department());
        p.setPopularity(r.getPopularity());

        if (r.getAlso_known_as() != null && !r.getAlso_known_as().isEmpty()) {
            p.setAlsoKnownAs(String.join("|", r.getAlso_known_as()));
        }
    }

    private LocalDate parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDate.parse(s);
        } catch (Exception e) {
            log.debug("PersonSync date parse failed for value='{}'; reason={}", s, e.getMessage());
            return null;
        }
    }
}
