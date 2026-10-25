package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
import com.db.dbworld.app.pm.dto.PasswordHistoryDto;
import com.db.dbworld.app.pm.dto.PasswordManagerDto;
import com.db.dbworld.app.pm.dto.SecretField;
import com.db.dbworld.app.pm.dto.VaultGroupDto;

import java.time.Instant;
import java.util.List;

public interface PasswordManagerService {

    void addCredential(String host, CredentialDto credential);

    /**
     * The user's live entries, grouped by site, without a single secret: which secrets exist, the
     * password's strength and whether it is reused. A secret is read with {@link #revealSecret}.
     */
    List<VaultGroupDto> getPasswordManagerByUser();

    /**
     * The user's live entries with every secret, for the encrypted offline copy on the installed
     * Android app. Counts one read against the same per-user limit as {@link #revealSecret}.
     *
     * @throws com.db.dbworld.core.exception.DbWorldException 429 over the limit
     */
    List<PasswordManagerDto> getSnapshot();

    /**
     * One secret of the caller's own live entry. Logged (ids only) and rate-limited per user.
     *
     * @return the value, null when the entry has none
     * @throws com.db.dbworld.core.exception.ResourceNotFoundException another user's entry, an
     *         unknown id, an entry in Trash, or a custom field or history row that is not this entry's
     * @throws com.db.dbworld.core.exception.DbWorldException 429 over the limit
     */
    String revealSecret(String credentialId, SecretField field);

    /** Moves every entry of the group to Trash (the group stays until they are purged). */
    void trashPasswordManager(String pmId);

    PasswordManagerDto updateCredential(String pmId, CredentialDto credential);

    CredentialDto getCredentialById(String credential);

    /** Moves one entry to Trash, where it waits 30 days before it is removed for good. */
    void trashCredential(String credentialId);

    /** The user's trashed entries, grouped and summarised like the vault list. */
    List<VaultGroupDto> listTrash();

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
     * When each earlier password of a live entry was replaced, newest first, at most five. The
     * passwords themselves are read with {@link #revealSecret} and {@link SecretField.History}.
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
