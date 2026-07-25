package com.db.dbworld.app.ipo.dto;

/** One row of the "My IPOs" list: a saved application joined with a light summary of its IPO. */
public record MyIpoDto(
        IpoApplicationDto application,
        IpoSummaryDto ipo
) {}
