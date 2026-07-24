package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.Instant;

/** One point on the subscription-over-time chart. */
public record SubscriptionPointDto(Instant t, BigDecimal qib, BigDecimal nii, BigDecimal retail, BigDecimal total) {}
