package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One point on the GMP-over-time chart. */
public record GmpPointDto(Instant t, BigDecimal gmp, BigDecimal gmpPct) {}
