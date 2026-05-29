package com.db.dbworld.infrastructure.logging.mdc;

import lombok.extern.log4j.Log4j2;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Tiny helper for fingerprinting request/response bodies into the MDC.
 *
 * <p>MD5 is used here strictly for non-cryptographic equality — dedup,
 * idempotency debugging, and audit ("did the client really submit the same
 * payload?"). Do not use this for anything security-sensitive.
 */
@Log4j2
public final class BodyMd5 {

    private static final String ALG = "MD5";
    private static final int    MAX_BYTES = 1 * 1024 * 1024; // 1 MiB cap

    private BodyMd5() {}

    /**
     * Hex-encoded MD5 of the given bytes, or {@code ""} if the input is null,
     * empty, exceeds {@link #MAX_BYTES}, or hashing fails.
     */
    public static String hex(byte[] bytes) {
        if (bytes == null || bytes.length == 0) return "";
        if (bytes.length > MAX_BYTES) {
            // Avoid stalling on huge payloads (uploads stream past the cache
            // anyway, so the MD5 wouldn't be representative).
            return "";
        }
        try {
            byte[] digest = MessageDigest.getInstance(ALG).digest(bytes);
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            // MD5 is required by every JRE — this is effectively unreachable,
            // but logging here is the right move if it ever fires.
            log.warn("MD5 algorithm unavailable on this JVM: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Composes the MDC value: {@code req=<hex>;res=<hex>}. Empty pieces are
     * omitted so the slot stays clean when only one body is available.
     */
    public static String composite(String reqHex, String resHex) {
        boolean hasReq = reqHex != null && !reqHex.isEmpty();
        boolean hasRes = resHex != null && !resHex.isEmpty();
        if (!hasReq && !hasRes) return "";
        if (hasReq && hasRes)   return "req=" + reqHex + ";res=" + resHex;
        if (hasReq)             return "req=" + reqHex;
        return "res=" + resHex;
    }
}
