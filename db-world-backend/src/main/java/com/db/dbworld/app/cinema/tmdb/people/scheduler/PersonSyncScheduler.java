package com.db.dbworld.app.cinema.tmdb.people.scheduler;

import com.db.dbworld.app.cinema.common.constants.CinemaConstants.Scheduler;
import com.db.dbworld.app.cinema.common.constants.CinemaConstants.Time;
import com.db.dbworld.app.cinema.tmdb.people.service.PersonSyncService;

import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Log4j2
public class PersonSyncScheduler {

    private final PersonSyncService personSyncService;

    /** Runs daily at 3 AM IST — after TMDB movie/TV syncs at 2 AM. */
    @Scheduled(cron = Scheduler.DAILY_3AM, zone = Time.ZONE_IST)
    public void runPersonSync() {
        long unsynced = personSyncService.countUnsynced();
        if (unsynced == 0) {
            log.info("PersonSync skipped — all persons already synced");
            return;
        }
        log.info("PersonSync scheduled run starting — {} unsynced persons", unsynced);
        personSyncService.syncUnsyncedPersons();
    }
}
