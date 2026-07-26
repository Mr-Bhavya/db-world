package com.db.dbworld.app.ipo.dto;

/**
 * One "Objects of the Issue" row for the detail page — what the company intends to do with the
 * net proceeds, and the estimated amount ({@code amount} is a display string like {@code
 * "₹102.00 Cr"}, or {@code null} when the row has no figure, e.g. "General corporate purposes").
 * Scraped only by {@code ChittorgarhSource}; persisted as a JSON array on the listing entity
 * ({@code issue_objects_json}).
 */
public record IpoIssueObjectDto(String purpose, String amount) {}
