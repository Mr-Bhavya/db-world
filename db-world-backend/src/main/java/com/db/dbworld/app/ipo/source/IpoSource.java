package com.db.dbworld.app.ipo.source;

import com.db.dbworld.app.ipo.dto.IpoDto;

import java.util.List;

/**
 * One external data provider for IPO information (IPO Guru, NSE, Chittorgarh, ...).
 *
 * <p>When the source as a whole cannot be read (network error, non-2xx, anti-bot block,
 * rate limit, a response with the wrong shape) {@link #fetchAll()} throws
 * {@link SourceFetchException}; missing credentials throw
 * {@link SourceFetchException#notConfigured}. The poll catches each source on its own, so one
 * failure never stops the others, and records it on {@code IpoSourcePollEntity}.
 *
 * <p>These used to log and return an empty list instead. The poll could not tell that from a
 * success, so it counted no failures and stamped every dead source as healthy, which also kept
 * the IPO list's "last updated" time fresh while nothing was being updated.
 *
 * <p>Failures enriching a single IPO (a detail page) stay inside the source: the list still came
 * back, so the source still answered.
 */
public interface IpoSource {

    /** Stable lower-case identifier, e.g. {@code "ipoguru"}, {@code "nse"}, {@code "chittorgarh"}. */
    String key();

    /**
     * Fetches every IPO this source currently reports, normalised into {@link IpoDto}. An empty
     * list means the source answered and has nothing; a failure throws.
     *
     * @throws SourceFetchException when the source could not be read, or is not configured
     */
    List<IpoDto> fetchAll();
}
