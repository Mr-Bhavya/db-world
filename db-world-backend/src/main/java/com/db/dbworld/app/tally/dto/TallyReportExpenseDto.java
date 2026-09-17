package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single expense called out by name in the report.
 *
 * @param amount the caller's share of it, not the bill — consistent with everything else here,
 *               so the number shown alongside "your biggest" adds up with the total above it.
 */
public record TallyReportExpenseDto(
        String expenseId,
        String groupId,
        String description,
        String category,
        LocalDate date,
        BigDecimal amount
) {}
