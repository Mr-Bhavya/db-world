package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A single source's normalised view of one IPO. Every field is nullable-friendly —
 * a given source may not report all of them.
 */
public record IpoDto(
        String source,
        String matchKey,
        String companyName,
        String ipoType,
        String status,
        LocalDate openDate,
        LocalDate closeDate,
        LocalDate allotmentDate,
        LocalDate listingDate,
        BigDecimal priceMin,
        BigDecimal priceMax,
        Integer lotSize,
        String issueSize,
        String listingExchange,
        BigDecimal listingPrice,
        BigDecimal listingGainPct,
        BigDecimal gmp,
        BigDecimal gmpPct,
        BigDecimal subQib,
        BigDecimal subNii,
        BigDecimal subRetail,
        BigDecimal subTotal,
        String allotmentStatus,
        String registrar,
        String registrarUrl,
        String logoUrl,
        String about,
        LocalDate refundDate,
        LocalDate dematDate
) {}
