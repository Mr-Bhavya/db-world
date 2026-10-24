package com.db.dbworld.app.cinema.tmdb.people.service;

public interface PersonSyncService {

    /**
     * Fetch full TMDB person details for all un-synced persons, rate-limited.
     *
     * @return what the pass actually did — reported on the admin Scheduler page, where a run
     *         that synced nothing used to be indistinguishable from one that synced hundreds
     */
    PersonSyncReport syncUnsyncedPersons(ProgressListener onProgress);

    /** Convenience for callers that do not care about progress. */
    default PersonSyncReport syncUnsyncedPersons() {
        return syncUnsyncedPersons((synced, gone, failed) -> {});
    }

    /**
     * Called after each person so a caller can show live progress. A plain callback rather
     * than the scheduler's summary type, so this service stays unaware of the admin layer.
     */
    @FunctionalInterface
    interface ProgressListener {
        void onProgress(long synced, long gone, long failed);
    }

    /** Returns count of persons not yet synced. */
    long countUnsynced();

    /**
     * @param pending   persons awaiting a detail fetch when the pass started
     * @param synced    persons successfully fetched and saved
     * @param gone      persons TMDB answered 404 for (deleted or merged there); deleted here
     *                  along with their credits, so they are not asked for again
     * @param failed    persons whose fetch threw or came back empty (retried next run);
     *                  synced + gone + failed is every person the pass reached
     * @param interrupted true when the pass stopped early on thread interruption
     */
    record PersonSyncReport(long pending, long synced, long gone, long failed, boolean interrupted) {}
}
