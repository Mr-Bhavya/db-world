package com.db.dbworld.app.cinema.catalog.tags.scheduler;

import com.db.dbworld.cinema.catalog.tags.services.RecordTaggingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Log4j2
@Service
@RequiredArgsConstructor
public class TagScheduler {

    private final RecordTaggingService recordTaggingService;

    @Scheduled(cron = "0 * * * * *")
    public void updateTags() {

        log.info("Starting catalog tag recalculation");

        recordTaggingService.recalculateAllTags();

        log.info("Finished catalog tag recalculation");
    }
}