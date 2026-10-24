package com.db.dbworld.app.pm.service;

import com.db.dbworld.app.pm.dto.CredentialDto;
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
     * Removes, for every user, the entries trashed before the cutoff (the daily purge job).
     *
     * @return how many entries were removed
     */
    int purgeTrashedBefore(Instant cutoff);

    List<String> getAllHosts();

}
