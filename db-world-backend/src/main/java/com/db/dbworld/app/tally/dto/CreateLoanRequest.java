package com.db.dbworld.app.tally.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Money lent or borrowed, as the client sends it.
 *
 * <p>Deliberately much smaller than {@link CreateExpenseRequest}. A loan has no split to decide
 * and no category to choose -- there are exactly two people and one of them owes the whole amount
 * -- so the six fields that describe an expense's division are not asked for. The service expands
 * this into the same payer and share rows an expense produces, which is what keeps the balance,
 * the settle-up plan and the void path working on a loan without knowing it is one.
 *
 * @param counterpartyMemberId the other person's member id in this ledger. Never the caller's:
 *                             lending to yourself is not a thing, and the service rejects it.
 * @param dueDate              optional. Plenty of loans between people have no agreed date, and
 *                             defaulting one would manufacture a deadline -- and a nudge to go
 *                             with it -- that nobody agreed to.
 */
public record CreateLoanRequest(

        @NotBlank String counterpartyMemberId,

        @NotNull TallyLoanDirection direction,

        @NotNull @DecimalMin("0.01") @Digits(integer = 10, fraction = 2)
        BigDecimal amount,

        /** The day the money moved, which is not the day the row was written. */
        @NotNull LocalDate loanDate,

        LocalDate dueDate,

        /** What it was for, if it matters. Shown in place of an expense's description. */
        @Size(max = 200) String note,

        /**
         * Retry token, unique within the group. Carries the same weight as it does on an expense:
         * a request that times out after the server committed is indistinguishable from one that
         * never arrived, and sending it again would record the loan twice.
         */
        @Size(max = 64) String idempotencyKey
) {}
