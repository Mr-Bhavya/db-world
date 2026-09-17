package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A payment one member made to another.
 *
 * <p>Settlement is one-sided - recording it is enough, nobody confirms from the other end - so
 * {@code idempotencyKey} carries real weight here. Without one, a request that times out after
 * the server committed looks exactly like one that never arrived, and the obvious response,
 * sending it again, drives the balance the wrong way by the full amount rather than merely
 * duplicating a row.
 *
 * @param settledAt when the money actually moved, which need not be now. Defaults to now.
 */
public record RecordSettlementRequest(

        @NotBlank String fromMemberId,
        @NotBlank String toMemberId,

        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2)
        BigDecimal amount,

        @Size(max = 40) String method,

        /**
         * The loan this payment repays, if it repays one. Null for an ordinary settle-up, which
         * is unallocated on purpose -- clearing a balance built from a dozen dinners does not
         * repay any particular dinner.
         */
        @Size(max = 36) String settlesExpenseId,
        Instant settledAt,
        @Size(max = 64) String idempotencyKey
) {}
