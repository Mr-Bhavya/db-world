package com.db.dbworld.app.tally.dto;

/**
 * Which way the money went, from the point of view of whoever is asking.
 *
 * <p>A request-and-response concept, not a stored one. Underneath there is only a loan row with a
 * payer and a beneficiary, and which of those is "me" decides the direction -- so the same loan is
 * LENT to one party and BORROWED to the other, and storing one word for it would have been wrong
 * for somebody.
 *
 * <p>It exists because the alternative is asking a reader to think in payers and shares. "I lent
 * Riya 1,000" is a sentence; "an expense of 1,000 that I paid and Riya consumed all of" is a data
 * model with a sentence hidden in it.
 */
public enum TallyLoanDirection {
    /** You handed the money over. They owe you. */
    LENT,
    /** They handed the money over. You owe them. */
    BORROWED
}
