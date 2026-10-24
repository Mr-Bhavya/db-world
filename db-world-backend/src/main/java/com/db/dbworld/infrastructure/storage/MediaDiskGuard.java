package com.db.dbworld.infrastructure.storage;

import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Answers one question: is the media disk really mounted right now?
 *
 * <p>All media lives on a USB disk mounted {@code nofail} at {@code app.data-path}. It can be
 * missing at boot and can drop out while the app runs, and either way the mount point is left
 * behind as an empty directory on the SD card. Two things must then never happen: a scan that
 * reads "no files" as "every file was deleted" and drops the database rows, and writes that
 * land on the SD under the mount point (and vanish behind the disk once it mounts again).
 *
 * <p>The signal is a marker file ({@code app.media-disk.marker}) that the host admin creates
 * once on the disk itself. Present: mounted. Absent: not mounted. A "same filesystem as /" test
 * would not do, because inside the container {@code /} is an overlay. With no marker configured
 * the guard is off and always reports mounted, so dev machines behave exactly as before.
 *
 * <p>The marker is checked on every call, never cached: one {@code stat}, and a cached answer
 * would let a scan that started before the disk dropped out go on to delete with it gone.
 */
@Log4j2
@Component
public class MediaDiskGuard {

    private final Path       marker;
    private final List<Path> mediaTreeRoots;

    /** Last state seen; null until the first check. Lets each flip be logged exactly once. */
    private final AtomicReference<Boolean> lastSeen = new AtomicReference<>();

    public MediaDiskGuard(AppProperties appProperties) {
        this.marker = appProperties.getMediaDiskMarker();
        List<Path> roots = appProperties.getMediaTreeRoots();
        this.mediaTreeRoots = roots != null ? roots : List.of();
        if (marker != null) {
            log.info("Media disk guard on: marker {}", marker);
        } else {
            log.debug("Media disk guard off: app.media-disk.marker is not set");
        }
    }

    /** True when a marker is configured, i.e. the guard can ever report the disk missing. */
    public boolean isEnabled() {
        return marker != null;
    }

    /** True when the disk is mounted, or when the guard is off. Re-checks the marker every call. */
    public boolean isMounted() {
        if (marker == null) return true;
        boolean mounted = Files.exists(marker);
        Boolean previous = lastSeen.getAndSet(mounted);
        // The first check counts as a flip only when it finds the disk missing.
        if (previous == null ? !mounted : previous != mounted) {
            if (mounted) {
                log.warn("Media disk is mounted again ({} is back). Media features resume.", marker);
            } else {
                log.warn("Media disk is NOT mounted: {} is missing. Media sync and cleanup will remove "
                        + "nothing, and writes into {} are refused until it returns.", marker, diskRoot());
            }
        }
        return mounted;
    }

    /**
     * Throws when the disk is not mounted, so {@code operation} never starts.
     *
     * @param operation what was about to run, as the start of a sentence: "Media sync"
     * @throws DbWorldException 503, with {@link #notMountedMessage}
     */
    public void requireMounted(String operation) {
        if (!isMounted()) {
            throw new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE, notMountedMessage(operation));
        }
    }

    /**
     * {@link #requireMounted} for an operation on one path: refuses only when {@code target} is
     * inside the media tree. A file-manager location on internal storage keeps working.
     */
    public void requireMountedFor(Path target, String operation) {
        if (isInMediaTree(target)) requireMounted(operation);
    }

    /** True when {@code path} is inside the media tree (data path, streams, symlinks, temp...). */
    public boolean isInMediaTree(Path path) {
        if (path == null) return false;
        Path p = path.toAbsolutePath().normalize();
        return mediaTreeRoots.stream().anyMatch(p::startsWith);
    }

    /** "The media disk is not mounted (/srv/dbworld). Media sync was not started." */
    public String notMountedMessage(String operation) {
        return "The media disk is not mounted (" + diskRoot() + "). " + operation + " was not started.";
    }

    /** Where the disk should be: the directory holding the marker. */
    private Path diskRoot() {
        if (marker == null) return null;
        Path parent = marker.getParent();
        return parent != null ? parent : marker;
    }
}
