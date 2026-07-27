package com.db.dbworld.app.ipo.dto;

import java.time.Instant;
import java.util.List;

/**
 * The IPO list view: every summary row plus the "Last updated" stamp the frontend shows,
 * sourced from {@code IpoSourcePollService.lastSuccessAcrossSources()}.
 */
public record IpoListResponse(List<IpoSummaryDto> ipos, Instant lastUpdated) {}
