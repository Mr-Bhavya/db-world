package com.db.dbworld.audit.tracking.admin.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/** One day of aggregate activity for the admin Activity console trend chart. */
public record TrendDto(
        LocalDate date,
        long streams,
        long downloads,
        BigDecimal gb
) {}
