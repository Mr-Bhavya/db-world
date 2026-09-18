package com.db.dbworld.app.live.entity;

/** Result of the last reachability probe against a stream URL. */
public enum LiveHealth {
    /**
     * Never probed, or the last probe was inconclusive. Still shown to users — a channel
     * is innocent until proven dead, otherwise a freshly imported playlist looks empty
     * until the first health run finishes.
     */
    UNKNOWN,
    /** Manifest fetched and parsed. */
    UP,
    /** Manifest unreachable, not a manifest, or stalled. Hidden from the public list. */
    DOWN
}
