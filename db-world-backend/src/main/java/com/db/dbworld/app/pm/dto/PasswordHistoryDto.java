package com.db.dbworld.app.pm.dto;

import java.time.Instant;

/**
 * An earlier password of an entry: when it was replaced, not what it was. The password itself is
 * revealed on its own, with {@code ?field=history:<id>}.
 */
public record PasswordHistoryDto(String id, Instant changedAt) {
}
