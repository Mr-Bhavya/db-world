package com.db.dbworld.app.cinema.tmdb.people.scheduler;

import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.apache.logging.log4j.ThreadContext;
import org.springframework.stereotype.Component;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Log4j2
public class PersonSyncScheduler {

    private final PersonSyncService personSyncService;

    public void runPersonSync() {
        ThreadContext.put("traceId", UUID.randomUUID().toString());
        long start = System.currentTimeMillis();

        try {
            long unsynced = personSyncService.countUnsynced();
            if (unsynced == 0) {
                log.info("PersonSync skipped — all persons already synced");
                return;
            }
            log.info("PersonSync scheduled run starting — {} unsynced persons", unsynced);
            personSyncService.syncUnsyncedPersons();
            log.info("PersonSync scheduled run completed; took={}ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.error("PersonSync scheduled run aborted; took={}ms", System.currentTimeMillis() - start, e);
            throw e;
        } finally {
            ThreadContext.clearAll();
        }
    }
}
