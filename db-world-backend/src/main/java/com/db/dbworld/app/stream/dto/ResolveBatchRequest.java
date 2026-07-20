package com.db.dbworld.app.stream.dto;

import java.util.List;

/**
 * Body for {@code POST /api/stream/resolve-batch}. Resolves several record-linked media
 * files (e.g. all quality variants of a title) in one round-trip.
 *
 * @param mediaFileIds UUIDs to resolve
 * @param type         ONLINE (stream, default) | DOWNLOAD
 */
public record ResolveBatchRequest(
        List<String> mediaFileIds,
        String type
) {}
