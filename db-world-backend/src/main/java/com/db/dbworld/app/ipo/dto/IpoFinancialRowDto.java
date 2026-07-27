package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One fiscal year's revenue/PAT (profit-after-tax)/total-assets AS SCRAPED FROM A SOURCE, carried
 * on {@link IpoDto#financials()} until ingest upserts it into {@code IpoFinancialEntity}.
 *
 * <p>Deliberately a separate type from the read-facing {@link IpoFinancialDto}: this one carries
 * {@code periodEnd} (the entity's real chronological sort key — {@code fiscalYear} is only a
 * display label and isn't sortable as a string, e.g. "Feb 2026" would otherwise sort before
 * "FY 2021-22"), which the API-facing dto has no need for.
 */
public record IpoFinancialRowDto(String fiscalYear, LocalDate periodEnd, BigDecimal revenue, BigDecimal pat, BigDecimal totalAssets) {}
