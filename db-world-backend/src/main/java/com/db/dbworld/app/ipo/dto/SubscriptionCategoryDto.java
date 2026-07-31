package com.db.dbworld.app.ipo.dto;

import java.math.BigDecimal;

/**
 * One category's full subscription breakdown for a point in time — the numbers investorgain shows
 * on its subscription page. {@code times} is the oversubscription multiple; {@code sharesOffered}/
 * {@code sharesBid} are absolute share counts; {@code bidAmountCr} is the bid value in ₹ crore.
 * "Lots" and "% of total" are derived on the frontend from {@code sharesOffered} (÷ lot size, and
 * ÷ the summed offered across categories), so they aren't stored here.
 */
public record SubscriptionCategoryDto(String category, BigDecimal times, BigDecimal sharesOffered,
                                      BigDecimal sharesBid, BigDecimal bidAmountCr) {}
