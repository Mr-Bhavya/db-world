package com.db.dbworld.app.wallet.dto;

import java.time.Instant;

// token is populated only in the create response (shown once); null when listing.
public record ShareDto(String id, String documentId, Instant expiresAt, Integer maxAccessCount,
                       int accessCount, boolean revoked, Instant createdAt, String token) {}
