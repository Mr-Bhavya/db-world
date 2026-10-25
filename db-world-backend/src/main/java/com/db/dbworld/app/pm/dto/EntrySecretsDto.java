package com.db.dbworld.app.pm.dto;

import java.util.Map;

/**
 * Every secret of one entry, for the edit form: what it would otherwise read one reveal at a time.
 *
 * @param customFields each custom field's value by field id, the clear ones (TEXT, URL) included
 */
public record EntrySecretsDto(String password, String pin, String notes, Map<String, String> customFields) {
}
