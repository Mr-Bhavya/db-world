package com.db.dbworld.app.live.scheduler;

import com.db.dbworld.app.admin.scheduler.dto.JobRunSummary;
import com.db.dbworld.app.live.service.LiveIngestService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

/**
 * Re-imports every enabled playlist. Correlation id, timing and the run-history row are
 * owned by {@code JobRunRecorder} on the scheduler side.
 */
@Component
@RequiredArgsConstructor
@Log4j2
public class LivePlaylistScheduler {

    public static final String JOB_ID = "LivePlaylistRefresh";

    private final LiveIngestService ingest;

    public void refresh(JobRunSummary.Builder summary) {
        var playlists = ingest.enabledPlaylists();
        if (playlists.isEmpty()) {
            summary.count("playlists", 0).note("No playlists configured — add one on the Live TV admin page");
            return;
        }

        LiveIngestService.RefreshResultOrSkip outcome = tryRefresh();
        if (outcome.skipped()) {
            summary.count("playlists", 0)
                   .note("Skipped — an import started elsewhere was still running");
            return;
        }

        var result = outcome.result();
        summary.count("playlists",      result.playlistsRefreshed())
               .count("failed",         result.playlistsFailed())
               .count("channelsNew",     result.channelsCreated())
               .count("channelsUpdated", result.channelsUpdated())
               .count("sourcesNew",      result.sourcesCreated())
               .count("sourcesRemoved",  result.sourcesRemoved());

        if (result.playlistsFailed() > 0) {
            summary.note(result.playlistsFailed() + " playlist(s) could not be fetched — see the Live TV page for the error");
        }
    }

    /**
     * An admin "Refresh all" overlapping this run is ordinary, not an error: the import
     * already in flight is doing the same work. Record it as a skip so the job history
     * does not fill with failures for a situation that needed no attention.
     */
    private LiveIngestService.RefreshResultOrSkip tryRefresh() {
        try {
            return LiveIngestService.RefreshResultOrSkip.of(ingest.refreshAll());
        } catch (LiveIngestService.ImportInProgressException e) {
            log.info("Live playlist refresh job skipped — an import is already running");
            return LiveIngestService.RefreshResultOrSkip.skip();
        }
    }
}
