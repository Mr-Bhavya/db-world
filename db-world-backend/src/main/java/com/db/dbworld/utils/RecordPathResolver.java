package com.db.dbworld.utils;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import lombok.extern.log4j.Log4j2;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
public final class RecordPathResolver {

    /**
     * Record folder format:
     *   4158-HIS & HERS
     *   4020-Man vs Baby
     *
     * Rules:
     *  - starts with digits
     *  - hyphen
     *  - at least one alphabet after hyphen
     */
    private static final Pattern RECORD_DIR_PATTERN = Pattern.compile("^(\\d+)-[A-Za-z].*");

    private RecordPathResolver() {}

    /* =========================================================
       PUBLIC API (GENERIC)
       ========================================================= */

    /**
     * Resolve recordId from a filesystem path.
     *
     * @param path filesystem path (file or directory)
     * @return Optional recordId
     */
    public static Optional<Long> resolveRecordId(Path path) {

        if (path == null) {
            return Optional.empty();
        }

        Path p = path.toAbsolutePath().normalize();

        while (p != null) {

            // Stop at filesystem root
            if (p.getParent() == null || p.getFileName() == null || p.getParent().equals(p)) {
                break;
            }

            if (Files.isDirectory(p)) {
                String dirName = p.getFileName().toString();
                Matcher matcher = RECORD_DIR_PATTERN.matcher(dirName);

                if (matcher.matches()) {
                    try {
                        return Optional.of(Long.parseLong(matcher.group(1)));
                    } catch (NumberFormatException ex) {
                        log.debug("[RECORD-RESOLVER] Invalid record id in {}", dirName);
                    }
                }
            }

            p = p.getParent();
        }

        return Optional.empty();
    }


    /* =========================================================
       PUBLIC API (DB-AWARE)
       ========================================================= */

    /**
     * Resolve record entity from path using repository lookup.
     *
     * @param path filesystem path
     * @param recordFinder function (e.g. repository::findById)
     */
    public static Optional<DBCinemaRecordsEntity> resolveRecord(
            Path path,
            Function<Long, Optional<DBCinemaRecordsEntity>> recordFinder
    ) {
        Optional<Long> recordId = resolveRecordId(path);
        if (recordId.isEmpty()) {
            return Optional.empty();
        }

        try {
            return recordFinder.apply(recordId.get());
        } catch (Exception ex) {
            log.warn("[RECORD-RESOLVER] Failed DB lookup for recordId={}", recordId.get(), ex);
            return Optional.empty();
        }
    }
}
