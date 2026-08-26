package com.db.dbworld.app.cinema.common.events;

/**
 * A record's set of media files changed: a file was ingested, re-collected, or had its
 * season/episode numbers corrected. Published from the media module (which owns the files)
 * so cinema-side features can react without the file writer knowing about them.
 *
 * <p>Distinct from {@link RecordChangedEvent}, which is about the record's own metadata and
 * drives rail cache eviction. This one says "what is playable here is different now".
 */
public record MediaFilesChangedEvent(Long recordId) {}
