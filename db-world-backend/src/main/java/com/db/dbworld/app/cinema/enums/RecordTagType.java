package com.db.dbworld.app.cinema.enums;

public enum RecordTagType {

    TRENDING,           // auto — popularity >= 80, capped at 30 records
    TOP_10,             // auto — top 10 by popularity
    FEATURED,           // auto — vote_avg >= 7.5 AND popularity >= 50
    EDITOR_PICK,        // manual — admin curated
    RECENTLY_ADDED,     // auto — added to catalog within last 30 days
    AVAILABLE_FOR_DOWNLOAD; // auto — record has at least one media file

}
