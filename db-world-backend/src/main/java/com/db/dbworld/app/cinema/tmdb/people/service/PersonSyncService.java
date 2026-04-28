package com.db.dbworld.app.cinema.tmdb.people.service;

public interface PersonSyncService {

    /** Fetch full TMDB person details for all un-synced persons, rate-limited. */
    void syncUnsyncedPersons();

    /** Returns count of persons not yet synced. */
    long countUnsynced();
}
