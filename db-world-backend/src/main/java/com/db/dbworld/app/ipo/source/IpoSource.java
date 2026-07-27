package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;

import java.util.List;

/**
 * One external data provider for IPO information (IPO Guru, NSE, Chittorgarh, ...).
 *
 * <p>Implementations must never let an expected upstream failure (network error,
 * non-2xx response, anti-bot block, malformed payload, missing credentials, ...)
 * escape {@link #fetchAll()} — on any such failure, log a warning and return an
 * empty list. The scheduler that drives these sources records success/failure via
 * {@code IpoSourcePollEntity} separately; a thrown exception here would only break
 * that bookkeeping for every other source polled in the same run.
 */
public interface IpoSource {

    /** Stable lower-case identifier, e.g. {@code "ipoguru"}, {@code "nse"}, {@code "chittorgarh"}. */
    String key();

    /**
     * Fetches every IPO this source currently reports, normalised into {@link IpoDto}.
     * Never throws for an expected upstream failure — returns {@code List.of()} instead.
     */
    List<IpoDto> fetchAll();
}
