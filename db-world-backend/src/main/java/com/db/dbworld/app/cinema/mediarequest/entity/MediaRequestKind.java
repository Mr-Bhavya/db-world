package com.db.dbworld.app.cinema.mediarequest.entity;

public enum MediaRequestKind {
    /** No media files exist for the record yet — add anything. */
    NEW_FILES,
    /** Files exist but the user wants a higher-quality copy (e.g. 1080p → 4K). */
    HIGHER_QUALITY,
    /** Files exist but the user wants a lighter copy for slow connections / small devices. */
    LOWER_QUALITY
}
