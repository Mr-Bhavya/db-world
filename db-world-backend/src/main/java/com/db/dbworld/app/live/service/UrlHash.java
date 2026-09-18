package com.db.dbworld.app.live.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * SHA-256 of a stream URL, used as the unique key of a channel source.
 *
 * <p>Not security-relevant — it exists because the URL column is too long for a MySQL
 * unique index, and the (channel, url) pair has to be unique or every refresh would
 * duplicate every source.
 */
public final class UrlHash {

    private UrlHash() {}

    public static String of(String url) {
        try {
            var digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(String.valueOf(url).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by every JVM", e);
        }
    }
}
