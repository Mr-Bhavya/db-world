package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * One point in the subscription series. {@code categories} (category name → multiple, insertion
 * order preserved) drives the day-wise multiples table and supports any category a source reports
 * (QIB, NII, S-NII, B-NII, RII, Employee, Shareholder, Other, ...). {@code categoryDetail} is the
 * fuller per-category breakdown (shares offered/bid, bid amount ₹Cr) for the investorgain-style
 * "current subscription" cards + offered/bid/amount table — empty on older rows that predate it.
 * {@code qib}/{@code nii}/{@code retail} are derived from {@code categories} (case-insensitive,
 * {@code null} if absent) purely for pre-{@code categories} frontend back-compat.
 */
public record SubscriptionPointDto(Instant t, BigDecimal total, Map<String, BigDecimal> categories,
                                    List<SubscriptionCategoryDto> categoryDetail,
                                    BigDecimal qib, BigDecimal nii, BigDecimal retail) {}
