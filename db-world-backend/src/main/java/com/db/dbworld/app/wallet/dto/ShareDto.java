package com.db.dbworld.app.wallet.dto;

import java.time.Instant;

// token is populated on create (shown once) and when listing active shares (re-copyable by the owner);
// stored encrypted at rest and never exposed to unauthenticated/public share resolution.
public record ShareDto(String id, String documentId, Instant expiresAt, Integer maxAccessCount,
                       int accessCount, boolean revoked, Instant createdAt, String token) {}
