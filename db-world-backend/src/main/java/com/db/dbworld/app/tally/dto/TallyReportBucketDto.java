package com.db.dbworld.app.tally.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One column of the spending chart: a day for a week or month report, a month for a year.
 *
 * <p>Carries the dates rather than a label so the client can format them in the user's locale;
 * the server has no business deciding whether that axis reads "Mon" or "lun".
 */
public record TallyReportBucketDto(
        LocalDate start,
        LocalDate end,
        BigDecimal amount
) {}
