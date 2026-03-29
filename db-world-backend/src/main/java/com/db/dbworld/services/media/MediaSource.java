package com.db.dbworld.services.media;

import lombok.Getter;

/**
 * @deprecated Migrated to {@link com.db.dbworld.app.media.stream.tag.MediaSource}.
 */
@Deprecated(forRemoval = true)
@Getter
public enum MediaSource {

    NETFLIX("NETFLIX", "WEB-DL", "NF", "NETFLIX"),
    AMAZON("AMAZON", "WEB-DL", "AMZN", "PRIME"),
    DISNEY("DISNEY", "WEB-DL", "DSNP", "DISNEY"),
    APPLE("APPLETV", "WEB-DL", "ATVP", "APPLETV"),
    HBO("HBO", "WEB-DL", "HBO"),
    HULU("HULU", "WEB-DL", "HULU"),
    PEACOCK("PEACOCK", "WEB-DL", "PEACOCK"),
    PARAMOUNT("PARAMOUNT", "WEB-DL", "PARAMOUNT"),
    YOUTUBE("YOUTUBE", "WEBRIP", "YT", "YOUTUBE"),
    CRUNCHYROLL("CRUNCHYROLL", "WEBRIP", "CR"),
    HOTSTAR("HOTSTAR", "WEB-DL", "HOTSTAR", "HS", "JHS"),
    SONYLIV("SONYLIV", "WEB-DL", "SONYLIV", "SNLV", "SL"),
    ZEE5("ZEE5", "WEB-DL", "ZEE5"),
    VOOT("VOOT", "WEB-DL", "VOOT"),
    MXPLAYER("MXPLAYER", "WEB-DL", "MX"),

    BLURAY("BLURAY", "BLURAY", "BLURAY"),
    UHD_BLURAY("UHD", "BLURAY", "UHD"),
    REMUX("REMUX", "REMUX", "REMUX"),
    DVD("DVD", "DVD", "DVD"),
    WEB_DL("WEB-DL", "WEB-DL", "WEB-DL", "WEBDL"),
    WEB_RIP("WEBRIP", "WEBRIP", "WEBRIP", "WEB-RIP"),
    HDTV("HDTV", "HDTV", "HDTV"),
    CAM("CAM", "CAM", "CAM"),
    TS("TS", "TS", "TS"),
    TELECINE("TC", "TC", "TC"),
    WORKPRINT("WORKPRINT", "WORKPRINT", "WORKPRINT"),

    UNKNOWN("", "", "");

    private final String label;
    private final String defaultType;
    private final String[] tokens;

    MediaSource(String label, String defaultType, String... tokens) {
        this.label = label;
        this.defaultType = defaultType;
        this.tokens = tokens;
    }

}

