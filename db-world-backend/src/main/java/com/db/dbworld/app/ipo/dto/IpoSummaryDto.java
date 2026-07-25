package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One row of the IPO list view. */
public record IpoSummaryDto(
        String id,
        String companyName,
        String ipoType,
        String status,
        LocalDate openDate,
        LocalDate closeDate,
        LocalDate listingDate,
        BigDecimal priceMin,
        BigDecimal priceMax,
        BigDecimal gmp,
        BigDecimal gmpPct,
        BigDecimal subTotal,
        String listingExchange,
        BigDecimal listingGainPct,
        String allotmentStatus,
        String logoUrl
) {}
