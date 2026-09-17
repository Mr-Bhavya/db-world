package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * What an export contains, before a single row is written.
 *
 * <p>A preview step exists because this is money with history attached. The people have to be
 * matched to accounts by hand — the file has names and nothing else, no emails and no ids — and
 * the rows that could not be read exactly need saying out loud rather than discovering later
 * that a two-year-old dinner has the wrong person eating it.
 *
 * @param warnings  everything uncertain, in words. Usually empty.
 * @param inferredRows how many expenses had several payers, where who consumed what is this
 *                     importer's guess. Balances are exact regardless.
 */
public record SplitwisePreviewDto(
        String currency,
        int expenseCount,
        int paymentCount,
        int inferredRows,
        LocalDate firstDate,
        LocalDate lastDate,
        BigDecimal totalSpend,
        List<SplitwisePersonDto> people,
        List<String> warnings,
        /** True when the file carried closing balances, so the import can be reconciled. */
        boolean reconcilable
) {}
