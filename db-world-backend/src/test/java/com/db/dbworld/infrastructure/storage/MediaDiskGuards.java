package com.db.dbworld.infrastructure.storage;

import com.db.dbworld.config.AppProperties;

import java.nio.file.Path;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Real {@link MediaDiskGuard}s for unit tests, configured without a Spring context. */
public final class MediaDiskGuards {

    private MediaDiskGuards() {
    }

    /** No marker configured: the dev default, always mounted. */
    public static MediaDiskGuard off() {
        return withMarker(null);
    }

    /**
     * A guard watching {@code marker}; mounted exactly while that file exists.
     *
     * @param mediaTreeRoots what counts as the media tree for the path-scoped checks
     */
    public static MediaDiskGuard withMarker(Path marker, Path... mediaTreeRoots) {
        AppProperties props = mock(AppProperties.class);
        when(props.getMediaDiskMarker()).thenReturn(marker);
        when(props.getMediaTreeRoots()).thenReturn(List.of(mediaTreeRoots));
        return new MediaDiskGuard(props);
    }
}
