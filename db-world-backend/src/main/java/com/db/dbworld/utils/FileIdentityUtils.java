package com.db.dbworld.utils;

import lombok.extern.log4j.Log4j2;

import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;

@Log4j2
public final class FileIdentityUtils {

    private static final int CHUNK = 1024 * 1024; // 1 MB

    /* ===================== STABILITY CHECK ===================== */

    public static boolean isStable(Path file, int seconds) {
        try {
            long size1 = Files.size(file);
            long mod1 = Files.getLastModifiedTime(file).toMillis();

            Thread.sleep(seconds * 1000L);

            long size2 = Files.size(file);
            long mod2 = Files.getLastModifiedTime(file).toMillis();

            return size1 == size2 && mod1 == mod2;
        } catch (Exception e) {
            return false;
        }
    }

    /* ===================== PARTIAL HASH ===================== */

    public static String partialHash(Path file) {
        try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "r")) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");

            byte[] buf = new byte[CHUNK];

            // first 1 MB
            raf.readFully(buf);
            digest.update(buf);

            // last 1 MB
            long len = raf.length();
            raf.seek(Math.max(0, len - CHUNK));
            raf.readFully(buf);
            digest.update(buf);

            return hex(digest.digest());
        } catch (Exception e) {
            log.warn("[HASH] Partial hash failed for {}", file, e);
            return null;
        }
    }

    /* ===================== FULL HASH (RARE) ===================== */

    public static String fullHash(Path file) {
        try (InputStream in = Files.newInputStream(file)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buf = new byte[CHUNK];
            int r;
            while ((r = in.read(buf)) > 0) {
                digest.update(buf, 0, r);
            }
            return hex(digest.digest());
        } catch (Exception e) {
            log.warn("[HASH] Full hash failed for {}", file, e);
            return null;
        }
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }

    private FileIdentityUtils() {}
}
