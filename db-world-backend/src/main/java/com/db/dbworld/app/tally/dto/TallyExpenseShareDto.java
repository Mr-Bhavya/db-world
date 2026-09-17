package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/**
 * One participant's slice, and who is on the hook for it.
 *
 * <p>{@code beneficiaryMemberId} is who consumed, {@code owedByMemberId} is who owes. They
 * differ whenever somebody's share is delegated, and keeping them apart is the premise of the
 * whole module.
 */
public record TallyExpenseShareDto(
        String beneficiaryMemberId,
        String owedByMemberId,
        BigDecimal amount,
        BigDecimal shareWeight,
        BigDecimal sharePercent
) {}
