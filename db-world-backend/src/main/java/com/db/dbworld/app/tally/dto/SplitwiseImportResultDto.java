package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * What the import did.
 *
 * @param reconciled true when every member's balance in the new group matched the export's own
 *                   closing figure. A false here cannot happen — the import refuses and rolls
 *                   back instead — so it exists to be asserted on rather than read.
 */
public record SplitwiseImportResultDto(
        TallyGroupDetailDto group,
        int expensesCreated,
        int settlementsCreated,
        int inferredRows,
        boolean reconciled,
        BigDecimal totalSpend,
        List<String> warnings
) {}
