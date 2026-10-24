package com.db.dbworld.app.pm.dto;

import java.time.Instant;

/** An earlier password of an entry and when it was replaced. */
public record PasswordHistoryDto(String id, String password, Instant changedAt) {
}
