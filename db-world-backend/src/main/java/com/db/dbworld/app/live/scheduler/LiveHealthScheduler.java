package com.db.dbworld.app.live.scheduler;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.live.service.LiveHealthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

/**
 * Probes live stream URLs and hides the dead ones.
 *
 * <p>Separate from the playlist refresh on purpose: a playlist's contents change rarely
 * (hours), while whether its streams answer changes constantly (minutes). Tying the two
 * together would either re-download every playlist far too often or leave dead channels
 * on screen for hours.
 */
@Component
@RequiredArgsConstructor
@Log4j2
public class LiveHealthScheduler {

    public static final String JOB_ID = "LiveHealthCheck";

    private final LiveHealthService health;

    public void check(JobRunSummary.Builder summary) {
        var result = health.probeAll();
        if (result.probed() == 0) {
            summary.count("probed", 0).note("Nothing to probe — no live stream URLs yet");
            return;
        }
        summary.count("probed",        result.probed())
               .count("sourcesUp",     result.up())
               .count("sourcesDown",   result.down())
               .count("channelsUp",    result.channelsUp())
               .count("channelsDown",  result.channelsDown());

        if (result.channelsDown() > 0) {
            summary.note(result.channelsDown() + " channel(s) have no working stream and are hidden from the grid");
        }
    }
}
