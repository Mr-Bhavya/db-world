package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One loan, with how much of it has come back.
 *
 * <h2>Three numbers, not one</h2>
 * The ledger has always known the balance between two people. What it could not say was the
 * PROGRESS of a particular loan: net 500 owed reads identically whether that is half of one
 * thousand-rupee loan or the whole of a five-hundred one. Both facts matter -- "I lent a thousand"
 * is the commitment, "five hundred came back" is the behaviour -- so all three travel together
 * rather than being reconstructed from a single figure that cannot carry them.
 *
 * <p>This is only derivable because a repayment now names the loan it repays; see
 * {@code TallySettlementEntity#settlesExpenseId}.
 *
 * @param principal   what was handed over. Never changes.
 * @param repaid      the sum of payments allocated to this loan. Can exceed the principal, if
 *                    somebody rounded up when paying back, and is reported as-is rather than
 *                    capped -- hiding an overpayment would be the ledger lying to be tidy.
 * @param outstanding what is still owed, floored at zero so an overpayment reads as "settled"
 *                    rather than as a negative debt.
 * @param direction   from the point of view of the caller, not of the ledger.
 * @param overdue     whether {@code dueDate} has passed with something still outstanding. Computed
 *                    server-side so every client agrees on what "today" means.
 */
public record TallyLoanDto(

        /** The underlying loan row's id -- an expense id, which is what a repayment points at. */
        String id,

        String groupId,
        String groupName,

        /** The other person, by name: who you lent to, or who you borrowed from. */
        String counterpartyName,
        String counterpartyMemberId,

        TallyLoanDirection direction,

        BigDecimal principal,
        BigDecimal repaid,
        BigDecimal outstanding,

        LocalDate loanDate,
        LocalDate dueDate,
        boolean overdue,

        /** True once nothing is outstanding. Kept as a field so a client need not compare money. */
        boolean settled,

        String note
) {}
