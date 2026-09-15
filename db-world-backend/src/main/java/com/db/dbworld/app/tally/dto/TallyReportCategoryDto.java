package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/**
 * What the caller consumed under one category.
 *
 * @param category the expense's own category, or null where none was set. Left null rather than
 *                 turned into "Uncategorised" here: the client already owns the category labels
 *                 and icons, and inventing a server-side label would give the same bucket two
 *                 names depending on which screen you are on.
 */
public record TallyReportCategoryDto(
        String category,
        BigDecimal amount
) {}
