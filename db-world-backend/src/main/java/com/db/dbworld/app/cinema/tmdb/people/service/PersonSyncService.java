package com.db.dbworld.app.cinema.tmdb.people.service;

public interface PersonSyncService {

    /**
     * Fetch full TMDB person details for all un-synced persons, rate-limited.
     *
     * @return what the pass actually did — reported on the admin Scheduler page, where a run
     *         that synced nothing used to be indistinguishable from one that synced hundreds
     */
    PersonSyncReport syncUnsyncedPersons();

    /** Returns count of persons not yet synced. */
    long countUnsynced();

    /**
     * @param pending   persons awaiting a detail fetch when the pass started
     * @param synced    persons successfully fetched and saved
     * @param failed    persons whose TMDB fetch threw (skipped, retried next run)
     * @param interrupted true when the pass stopped early on thread interruption
     */
    record PersonSyncReport(long pending, long synced, long failed, boolean interrupted) {}
}
