package com.db.dbworld.app.ipo.dto;

/**
 * One key-performance-indicator row for the detail page — a display label and its (already
 * display-formatted) value, e.g. {@code ("ROE", "34.78%")}, {@code ("P/E (x)", "16.3")},
 * {@code ("Market Cap", "₹664.03 Cr.")}. Values are kept as the source's own strings (percent
 * signs, ₹, etc. intact) rather than parsed numbers, since KPIs are heterogeneous and only ever
 * displayed. Scraped only by {@code ChittorgarhSource}; persisted as a JSON array on the listing
 * entity ({@code kpis_json}).
 */
public record IpoKpiDto(String label, String value) {}
