package com.db.dbworld.app.tally.dto;

import com.db.dbworld.app.tally.entity.TallyMethod;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * A new expense, as the client sends it.
 *
 * <p>Amounts are pinned to two decimals <b>here</b>, at the boundary, rather than being cleaned
 * up later: MySQL in strict mode rejects a third decimal where H2 silently rounds it, so a
 * value that survives the tests would fail in production. Rejecting it up front makes the two
 * agree.
 */
public record CreateExpenseRequest(

        @NotBlank @Size(max = 200)
        String description,

        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2)
        BigDecimal totalAmount,

        @NotNull
        TallyMethod divisionMethod,

        @Size(max = 60)
        String category,

        @NotNull
        LocalDate expenseDate,

        @Size(max = 1000)
        String notes,

        /**
         * Retry token, unique within the group. Strongly recommended: without one, a request
         * that times out after the server committed is indistinguishable from one that never
         * arrived, and the obvious response — send it again — doubles the expense.
         */
        @Size(max = 64)
        String idempotencyKey,

        @NotEmpty @Valid
        List<PayerInput> payers,

        @NotEmpty @Valid
        List<ParticipantInput> participants
) {

    /** Who actually paid, and how much. One entry for the ordinary case. */
    public record PayerInput(
            @NotBlank String memberId,
            @NotNull @DecimalMin(value = "0.01") @Digits(integer = 10, fraction = 2) BigDecimal amount
    ) {}

    /**
     * Who the expense is being split among, and on what basis.
     *
     * <p>Which of {@code exactAmount} / {@code percent} / {@code shareWeight} is read depends on
     * the expense's {@link TallyMethod}; the others are ignored rather than rejected, so a
     * client can keep the user's last-entered values while they switch between tabs.
     */
    public record ParticipantInput(

            /** The beneficiary — who consumed. */
            @NotBlank String memberId,

            @DecimalMin(value = "0.00") @Digits(integer = 10, fraction = 2) BigDecimal exactAmount,
            @DecimalMin(value = "0.0000") @Digits(integer = 3, fraction = 4) BigDecimal percent,
            @DecimalMin(value = "0.0000") @Digits(integer = 8, fraction = 4) BigDecimal shareWeight,

            /**
             * Who settles this share, overriding the member's standing delegation.
             *
             * <p><b>Null means "use the standing default", not "nobody".</b> There is no
             * "nobody": liability always lands on someone, which is why
             * {@code owed_by_member_id} is NOT NULL in the database. A participant who wants to
             * pay their own way despite having a standing delegation says so by sending their
             * own member id here — explicit, and distinguishable from an absent field.
             */
            String owedByMemberId
    ) {}
}
