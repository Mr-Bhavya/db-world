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
        Integer lotSize,
        String listingExchange,
        BigDecimal listingPrice,
        BigDecimal listingGainPct,
        String allotmentStatus,
        String logoUrl,
        String logoDomain,
        String registrarUrl,
        /** Investorgain's 1–5 GMP rating — the card's at-a-glance "how hot is this" signal. */
        Integer gmpRating,
        /** Their own "as of" label for the GMP, so the card can say how fresh the number is. */
        String gmpUpdatedLabel
) {}
