package com.db.dbworld.app.media.ingestion.processing.fs;

import lombok.extern.log4j.Log4j2;

import java.io.IOException;
import java.nio.file.DirectoryNotEmptyException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Set;

/**
 * Removes the empty folders a finished ingestion job leaves under the temp root.
 *
 * <p>Every job works in {@code temp/<folder>}. The pipeline deleted the job's files when it ended
 * but never the folder, so production collected over a hundred empty {@code <recordId>-<Title>}
 * folders. This removes a folder only while it is empty and then climbs to its parent, so it can
 * never take anything a job, an upload or the thumbnail cache still holds.
 */
@Log4j2
public final class TempDirPruner {

    /**
     * Top-level temp folders that other features own. They are kept even when empty, and nothing
     * beneath them is touched: {@code unassigned} holds files waiting to be linked to a record,
     * {@code uploads} the file-manager upload sessions and {@code fm-thumbs} the thumbnail cache.
     * A job whose folder name happens to be one of these must not delete it on the way out.
     */
    static final Set<String> RESERVED = Set.of("unassigned", "uploads", "fm-thumbs");

    private TempDirPruner() {
    }

    /**
     * Deletes {@code dir} if it is empty, then each parent that is now empty, stopping below
     * {@code tempRoot}. Never throws: a folder that cannot be removed is simply left in place.
     *
     * @return how many directories were removed
     */
    public static int pruneEmptyDirs(Path tempRoot, Path dir) {
        if (tempRoot == null || dir == null) return 0;
        Path root = tempRoot.toAbsolutePath().normalize();
        int removed = 0;
        for (Path current = dir.toAbsolutePath().normalize();
             isPrunable(root, current);
             current = current.getParent()) {
            // Already gone, or never created because the job failed early: its parent may still
            // be an empty leftover, so keep climbing.
            if (!Files.exists(current, LinkOption.NOFOLLOW_LINKS)) continue;
            // A file, or a symlink someone put there on purpose. Deleting a link would not check
            // whether its target is empty, so it is never ours to remove.
            if (!Files.isDirectory(current, LinkOption.NOFOLLOW_LINKS)) break;
            try {
                Files.delete(current);
                removed++;
                log.debug("Removed empty temp folder {}", current);
            } catch (DirectoryNotEmptyException e) {
                // Another job for the same record, or leftovers worth a look. Either way it stays,
                // and so does every parent above it.
                log.debug("Temp folder {} is not empty, leaving it", current);
                break;
            } catch (IOException | SecurityException e) {
                log.debug("Could not remove temp folder {}: {}", current, e.toString());
                break;
            }
        }
        return removed;
    }

    /** Strictly below the temp root, and not a reserved folder or anything inside one. */
    private static boolean isPrunable(Path root, Path dir) {
        if (dir == null || dir.equals(root) || !dir.startsWith(root)) return false;
        String topLevel = root.relativize(dir).getName(0).toString();
        // Lower-cased so a case-insensitive file system cannot reach a reserved folder by another spelling.
        return !RESERVED.contains(topLevel.toLowerCase(Locale.ROOT));
    }
}
