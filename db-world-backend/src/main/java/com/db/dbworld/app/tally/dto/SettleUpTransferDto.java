package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/**
 * One suggested payment from the settle-up plan.
 *
 * <p>Advice, never a mutation. Recording one is an ordinary settlement, and the ledger keeps the
 * true pairwise debts underneath - which is what preserves the answer to "why do I owe this",
 * the question people actually ask.
 *
 * <p>Names travel with the ids so the client can render the plan without a second lookup, and so
 * a departed member still reads as a person.
 */
public record SettleUpTransferDto(
        String fromMemberId,
        String fromMemberName,
        String toMemberId,
        String toMemberName,
        BigDecimal amount
) {}
