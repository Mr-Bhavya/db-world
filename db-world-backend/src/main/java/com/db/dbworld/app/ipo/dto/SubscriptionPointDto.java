package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

/**
 * One point on the subscription-over-time chart. {@code categories} (category name → multiple,
 * insertion order preserved) is the source of truth going forward and supports any category a
 * source reports (QIB, NII, Retail, Employee, Shareholder, Anchor, ...); the frontend applies its
 * own preferred display order. {@code qib}/{@code nii}/{@code retail} are derived from
 * {@code categories} (case-insensitive lookup, {@code null} if the category is absent) purely for
 * backward compatibility with the pre-{@code categories} frontend — kept until that frontend
 * migrates to reading {@code categories} directly.
 */
public record SubscriptionPointDto(Instant t, BigDecimal total, Map<String, BigDecimal> categories,
                                    BigDecimal qib, BigDecimal nii, BigDecimal retail) {}
