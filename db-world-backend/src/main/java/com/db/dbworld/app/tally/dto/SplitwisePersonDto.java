package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;

/**
 * One column of the export: a person, and where they ended up.
 *
 * @param closingBalance Splitwise's own final figure for them, positive when they are owed.
 *                       Null when the file carried no closing total. The import reconciles
 *                       against this, so it is shown before anybody commits to anything.
 */
public record SplitwisePersonDto(
        String name,
        BigDecimal paid,
        BigDecimal consumed,
        BigDecimal closingBalance
) {}
