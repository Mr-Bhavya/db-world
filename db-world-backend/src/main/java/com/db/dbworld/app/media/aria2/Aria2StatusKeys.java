package com.db.dbworld.app.media.aria2;

import java.util.HashSet;
import java.util.Set;

/**
 * Aria2 RPC field name constants and predefined key-sets.
 * Migrated from com.db.dbworld.services.aria2.Aria2StatusKeys.
 */
public final class Aria2StatusKeys {

    private Aria2StatusKeys() {}

    public static final String GID              = "gid";
    public static final String STATUS           = "status";
    public static final String TOTAL_LENGTH     = "totalLength";
    public static final String COMPLETED_LENGTH = "completedLength";
    public static final String UPLOAD_LENGTH    = "uploadLength";
    public static final String DOWNLOAD_SPEED   = "downloadSpeed";
    public static final String UPLOAD_SPEED     = "uploadSpeed";
    public static final String CONNECTIONS      = "connections";
    public static final String NUM_SEEDERS      = "numSeeders";
    public static final String SEEDER           = "seeder";
    public static final String DIR              = "dir";
    public static final String FILES            = "files";
    public static final String BITTORRENT       = "bittorrent";
    public static final String PIECE_LENGTH     = "pieceLength";
    public static final String NUM_PIECES       = "numPieces";
    public static final String ERROR_CODE       = "errorCode";
    public static final String ERROR_MESSAGE    = "errorMessage";
    public static final String INFO_HASH        = "infoHash";
    public static final String FOLLOWED_BY      = "followedBy";
    public static final String BELONGS_TO       = "belongsTo";
    public static final String BITFIELD         = "bitfield";
    public static final String COMPLETED_DATE_TIME = "completedDateTime";

    /** Minimal set — gid + status + sizes only. Used for the polling loop. */
    public static final Set<String> BASIC_KEYS = Set.of(
            GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH
    );

    /** Full active-download set — includes speed, connections, files. */
    public static final Set<String> ACTIVE_KEYS = Set.of(
            GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DOWNLOAD_SPEED, UPLOAD_SPEED, CONNECTIONS, NUM_SEEDERS,
            PIECE_LENGTH, NUM_PIECES, BITFIELD, ERROR_MESSAGE, DIR, FILES
    );

    /** Completion snapshot. */
    public static final Set<String> COMPLETE_KEYS = Set.of(
            GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DIR, FILES, BITTORRENT, COMPLETED_DATE_TIME, PIECE_LENGTH
    );

    /** Everything — used when a detailed view is needed. */
    public static final Set<String> DETAILED_KEYS = Set.of(
            GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            BITFIELD, DOWNLOAD_SPEED, UPLOAD_SPEED, INFO_HASH, NUM_SEEDERS,
            SEEDER, PIECE_LENGTH, NUM_PIECES, CONNECTIONS, ERROR_CODE, ERROR_MESSAGE,
            FOLLOWED_BY, BELONGS_TO, DIR, FILES, BITTORRENT
    );

    /** Final-state set — used in requestFinalStatus(). */
    public static final Set<String> FINAL_STATUS_KEYS = Set.of(
            GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DIR, FILES, BITTORRENT, ERROR_MESSAGE, ERROR_CODE,
            DOWNLOAD_SPEED, UPLOAD_SPEED, CONNECTIONS, NUM_SEEDERS,
            INFO_HASH, FOLLOWED_BY, BITFIELD
    );

    /** Only the followedBy field — used for torrent metadata GID resolution. */
    public static final Set<String> FOLLOWED_BY_KEY = Set.of(FOLLOWED_BY);

    public static Set<String> merge(Set<String> a, Set<String> b) {
        Set<String> merged = new HashSet<>(a);
        merged.addAll(b);
        return merged;
    }
}
