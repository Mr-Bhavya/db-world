package com.db.dbworld.services.aria2;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;
import java.util.Collections;

@Data
public class Aria2StatusKeys {
    // Basic download info
    public static final String ID = "id";
    public static final String GID = "gid";
    public static final String STATUS = "status";
    public static final String TOTAL_LENGTH = "totalLength";
    public static final String COMPLETED_LENGTH = "completedLength";
    public static final String UPLOAD_LENGTH = "uploadLength";
    public static final String BITFIELD = "bitfield";
    public static final String DOWNLOAD_SPEED = "downloadSpeed";
    public static final String UPLOAD_SPEED = "uploadSpeed";

    // Connection info
    public static final String CONNECTIONS = "connections";
    public static final String NUM_SEEDERS = "numSeeders";
    public static final String SEEDER = "seeder";

    // File info
    public static final String DIR = "dir";
    public static final String FILES = "files";
    public static final String BITTORRENT = "bittorrent";

    // Piece info
    public static final String PIECE_LENGTH = "pieceLength";
    public static final String NUM_PIECES = "numPieces";

    // Error info
    public static final String ERROR_CODE = "errorCode";
    public static final String ERROR_MESSAGE = "errorMessage";

    // Additional info
    public static final String INFO_HASH = "infoHash";
    public static final String FOLLOWED_BY = "followedBy";
    public static final String BELONGS_TO = "belongsTo";
    public static final String COMPLETED_DATE_TIME = "completedDateTime";

    // Predefined key sets for different use cases
    public static final Set<String> BASIC_KEYS = Set.of(
            ID, GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH
    );

    public static final Set<String> ACTIVE_KEYS = Set.of(
            ID, GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DOWNLOAD_SPEED, UPLOAD_SPEED, CONNECTIONS, NUM_SEEDERS,
            PIECE_LENGTH, NUM_PIECES, BITFIELD, ERROR_MESSAGE, DIR, FILES
    );

    public static final Set<String> COMPLETE_KEYS = Set.of(
            ID, GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DIR, FILES, BITTORRENT, COMPLETED_DATE_TIME, PIECE_LENGTH
    );

    public static final Set<String> DETAILED_KEYS = Set.of(
            ID, GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            BITFIELD, DOWNLOAD_SPEED, UPLOAD_SPEED, INFO_HASH, NUM_SEEDERS,
            SEEDER, PIECE_LENGTH, NUM_PIECES, CONNECTIONS, ERROR_CODE, ERROR_MESSAGE,
            FOLLOWED_BY, BELONGS_TO, DIR, FILES, BITTORRENT
    );

    public static final Set<String> FINAL_STATUS_KEYS = Set.of(
            ID, GID, STATUS, TOTAL_LENGTH, COMPLETED_LENGTH, UPLOAD_LENGTH,
            DIR, FILES, BITTORRENT, ERROR_MESSAGE, ERROR_CODE,
            DOWNLOAD_SPEED, UPLOAD_SPEED, CONNECTIONS, NUM_SEEDERS,
            INFO_HASH, FOLLOWED_BY, BITFIELD
    );

    public static final Set<String> FOLLOWED_BY_KEY = Set.of(FOLLOWED_BY);

    // Utility methods to combine keys
    public static String[] combineKeys(Set<String> baseKeys, String... additionalKeys) {
        Set<String> combined = new HashSet<>(baseKeys);
        combined.addAll(Arrays.asList(additionalKeys));
        return combined.toArray(String[]::new);
    }

    public static String[] combineKeys(Set<String> baseKeys, Set<String> additionalKeys) {
        Set<String> combined = new HashSet<>(baseKeys);
        combined.addAll(additionalKeys);
        return combined.toArray(String[]::new);
    }

    public static Set<String> of(String... keys) {
        return Set.of(keys);
    }
}
