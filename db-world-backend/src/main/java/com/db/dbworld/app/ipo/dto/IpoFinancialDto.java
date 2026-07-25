package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;

/** One fiscal year's revenue/PAT (profit-after-tax), in Rupees crore, for the detail page's P&L section. */
public record IpoFinancialDto(String fiscalYear, BigDecimal revenue, BigDecimal pat) {}
