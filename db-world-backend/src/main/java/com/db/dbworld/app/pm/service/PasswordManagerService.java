package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;

import java.time.Instant;
import java.util.List;

public interface PasswordManagerService {

    void addCredential(String host, CredentialDto credential);

    List<PasswordManagerDto> getPasswordManagerByUser();

    /** Moves every entry of the group to Trash (the group stays until they are purged). */
    void trashPasswordManager(String pmId);

    PasswordManagerDto updateCredential(String pmId, CredentialDto credential);

    CredentialDto getCredentialById(String credential);

    /** Moves one entry to Trash, where it waits 30 days before it is removed for good. */
    void trashCredential(String credentialId);

    /** The user's trashed entries, grouped like the vault list. */
    List<PasswordManagerDto> listTrash();

    /**
     * Takes an entry out of Trash.
     *
     * @throws com.db.dbworld.core.exception.DbWorldException 409 when a live entry with the same
     *         name and username already exists on that site
     */
    void restore(String credentialId);

    /** Removes a trashed entry for good. A live entry cannot be purged. */
    void purge(String credentialId);

    /**
     * The ids of every user's entries trashed before the cutoff: what the daily purge job removes,
     * one {@link #purgeTrashedEntry} call each.
     */
    List<String> findTrashedBefore(Instant cutoff);

    /**
     * Removes one entry that has been in Trash since before the cutoff, for good, in a transaction
     * of its own: a failure here rolls back this entry only, never the rest of the daily purge. An
     * entry that is gone, was restored in the meantime, or is not past the cutoff is left alone.
     *
     * <p>Not for callers inside this service: the new transaction only exists on a call that goes
     * through the Spring proxy.
     *
     * @return true when the entry was removed
     */
    boolean purgeTrashedEntry(String credentialId, Instant cutoff);

    /**
     * The earlier passwords of a live entry, newest first, at most five.
     *
     * @throws com.db.dbworld.core.exception.ResourceNotFoundException another user's entry, an
     *         unknown id, or an entry in Trash
     */
    List<PasswordHistoryDto> getHistory(String credentialId);

    /**
     * Puts an earlier password back as the current one. The password it replaces goes into the
     * history, so the restore can be undone; the restored row is used up.
     *
     * @throws com.db.dbworld.core.exception.ResourceNotFoundException the entry is not the caller's
     *         (or is in Trash), or the history row does not belong to it
     */
    void restorePassword(String credentialId, String historyId);

    List<String> getAllHosts();

}
