package com.db.dbworld.app.cinema.tmdb.people.service.impl;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.TmdbSync;
import com.db.dbworld.app.cinema.tmdb.client.TmdbClient;
import com.db.dbworld.app.cinema.tmdb.client.dto.PersonTmdbResponse;
import com.db.dbworld.app.cinema.tmdb.people.entity.PersonEntity;
import com.db.dbworld.app.cinema.tmdb.people.repository.PersonRepository;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Log4j2
@Service
@RequiredArgsConstructor
public class PersonSyncServiceImpl implements PersonSyncService {

    private static final int BATCH_SIZE = 50;

    private final PersonRepository personRepository;
    private final TmdbClient       tmdbClient;

    @Override
    public void syncUnsyncedPersons() {

        long total   = personRepository.countByPersonSyncedFalse();
        long synced  = 0;
        long failed  = 0;
        int  pageNum = 0;

        log.info("PersonSync starting — {} persons need full detail fetch", total);

        while (true) {
            Page<PersonEntity> batch = personRepository.findByPersonSyncedFalse(
                    PageRequest.of(pageNum, BATCH_SIZE));

            if (batch.isEmpty()) break;

            List<PersonEntity> persons = batch.getContent();
            log.info("PersonSync batch {} — {} persons", pageNum, persons.size());

            for (PersonEntity person : persons) {
                try {
                    PersonTmdbResponse resp = tmdbClient.getPerson(person.getId()).block();
                    if (resp != null) {
                        applyDetails(person, resp);
                        person.setPersonSynced(true);
                        personRepository.save(person);
                        synced++;
                    }
                } catch (Exception e) {
                    log.warn("PersonSync failed for id={}: {}", person.getId(), e.getMessage());
                    failed++;
                }

                // Rate-limit: stay within TMDB's ~50 requests/sec free-tier guideline
                try { Thread.sleep(TmdbSync.DELAY_MS); } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("PersonSync interrupted");
                    return;
                }
            }

            if (batch.isLast()) break;

            // Always re-query page 0 because we mark rows synced; the page shifts
            // Stay at page 0 to consume remaining un-synced rows
        }

        log.info("PersonSync complete — synced={}, failed={}", synced, failed);
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
