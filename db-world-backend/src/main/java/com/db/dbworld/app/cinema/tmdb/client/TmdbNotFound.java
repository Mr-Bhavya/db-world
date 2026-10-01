package com.db.dbworld.app.cinema.tmdb.client;

import com.db.dbworld.app.cinema.enums.RecordType;
import org.springframework.http.HttpRequest;
import org.springframework.web.reactive.function.client.WebClientResponseException;

/**
 * Tells "TMDB has deleted this title" apart from every other refresh failure.
 *
 * <p>A refresh fetches the detail, {@code /watch/providers} and {@code /reviews} together, and
 * whichever 404s first is the one that surfaces, so all three count. A TV refresh then fetches
 * each season; a 404 there means a missing season, not a missing show, so it does not.
 */
public final class TmdbNotFound {

    private TmdbNotFound() {}

    public static boolean isTitleGone(Throwable failure, RecordType type, long tmdbId) {
        for (Throwable t = failure; t != null; t = t.getCause()) {
            if (t instanceof WebClientResponseException.NotFound notFound) {
                HttpRequest request = notFound.getRequest();
                return request != null && isTitlePath(request.getURI().getPath(), type, tmdbId);
            }
        }
        return false;
    }

    private static boolean isTitlePath(String path, RecordType type, long tmdbId) {
        if (path == null) return false;
        String title = (type == RecordType.MOVIE ? "/movie/" : "/tv/") + tmdbId;
        return path.endsWith(title)
                || path.endsWith(title + "/watch/providers")
                || path.endsWith(title + "/reviews");
    }
}
