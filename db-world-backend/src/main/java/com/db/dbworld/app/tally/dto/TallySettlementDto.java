package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallySettlementStatus;

import java.math.BigDecimal;
import java.time.Instant;

/** A payment between two members, as recorded. */
public record TallySettlementDto(
        String id,
        String groupId,
        String fromMemberId,
        String toMemberId,
        BigDecimal amount,
        String method,
        Instant settledAt,
        TallySettlementStatus status,
        Long recordedByUserId,
        Instant createdAt
) {}
