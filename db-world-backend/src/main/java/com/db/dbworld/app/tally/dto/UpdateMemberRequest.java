package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyMemberRole;
import jakarta.validation.constraints.Size;

/**
 * A change to one member. Every field is optional; null means "leave it".
 *
 * <p>{@code clearDelegation} exists because null cannot say two things at once. A null
 * {@code paidForByMemberId} has to mean "don't touch this", so removing an existing delegation
 * needs its own signal - otherwise every PATCH that simply did not mention delegation would
 * wipe one.
 */
public record UpdateMemberRequest(
        @Size(max = 120) String displayName,
        TallyMemberRole role,
        String paidForByMemberId,
        boolean clearDelegation
) {}
