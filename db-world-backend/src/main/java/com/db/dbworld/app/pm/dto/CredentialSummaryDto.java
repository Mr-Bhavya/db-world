package com.db.dbworld.app.pm.dto;

import com.db.dbworld.app.pm.entity.CredentialType;
import com.db.dbworld.app.pm.entity.CustomFieldType;

import java.time.Instant;
import java.util.List;

/**
 * One entry as the vault list and the Trash show it: everything except the secrets. The password,
 * PIN, notes and every hidden custom-field value stay on the server until the user asks for one
 * ({@code GET /api/pm/credential/{id}/secret}); the list only says which of them exist.
 *
 * @param strength  0 for no password, else 1-5 on the client's {@code scorePassword} scale
 * @param reused    the password is also the password of another live entry of the same user
 * @param breached  false until breach checks exist
 * @param deletedAt when the entry was trashed; null on a live one
 */
public record CredentialSummaryDto(
        String id,
        String name,
        CredentialType type,
        String url,
        String username,
        boolean hasPassword,
        boolean hasPin,
        boolean hasNotes,
        int strength,
        boolean reused,
        boolean breached,
        List<FieldSummary> customFields,
        Instant deletedAt) {

    /**
     * A custom field without its value, except for TEXT and URL fields, which are shown in the
     * clear anyway. hasValue says whether there is one to reveal, so an empty hidden field is not
     * shown as a masked row that has nothing behind it.
     */
    public record FieldSummary(String id, String fieldKey, CustomFieldType fieldType, String fieldValue,
                               boolean hasValue) {
    }
}
