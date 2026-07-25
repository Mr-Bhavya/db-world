package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;

/**
 * One fiscal year's revenue/PAT (profit-after-tax)/total-assets, in Rupees crore, for the detail
 * page's P&amp;L section. {@code totalAssets} is nullable — a real source may not report it.
 */
public record IpoFinancialDto(String fiscalYear, BigDecimal revenue, BigDecimal pat, BigDecimal totalAssets) {}
