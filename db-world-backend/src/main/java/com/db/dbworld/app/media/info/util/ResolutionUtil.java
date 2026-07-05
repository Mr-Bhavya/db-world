package com.db.dbworld.app.media.info.util;

/**
 * Resolution / aspect-ratio helpers shared by the media-info DTO mappers.
 *
 * <p>Why this exists: MediaInfo reports the <em>stored</em> (coded) pixel
 * dimensions in {@code Width}/{@code Height}. For anamorphic content — where the
 * pixel aspect ratio is not 1:1 — those stored pixels are stretched on playback,
 * so the stored width is <strong>not</strong> the resolution a viewer sees. A
 * classic example: a file named {@code …720p…} that MediaInfo reports as
 * 1620×1080; the pixels are non-square and the true display frame is 1920×1080.
 *
 * <p>{@link #compute} derives the true display resolution from the stored height
 * and the {@code DisplayAspectRatio}, then classifies it into a standard tier
 * ("4K", "1080p", …) using width <em>or</em> height with a tolerance so cropped
 * widescreen encodes (e.g. 3840×1600 UHD, 1920×800 1080p) land in the right tier
 * instead of being under-rated by their reduced height.
 */
public final class ResolutionUtil {

    private ResolutionUtil() {}

    /**
     * Parses a MediaInfo {@code DisplayAspectRatio} value into a decimal ratio.
     * Accepts both the numeric form ("1.778", "1.850") and the string form
     * ("16:9", "4:3", "2.40:1", "2.40 : 1"). Returns {@code null} when unparseable.
     */
    public static Double parseAspectRatio(String dar) {
        if (dar == null) return null;
        String s = dar.trim();
        if (s.isEmpty()) return null;
        try {
            if (s.contains(":")) {
                String[] parts = s.split(":");
                if (parts.length != 2) return null;
                double a = Double.parseDouble(parts[0].trim());
                double b = Double.parseDouble(parts[1].trim());
                return b != 0 ? a / b : null;
            }
            double v = Double.parseDouble(s);
            return v > 0 ? v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * True display width = round(displayAspectRatio × storedHeight). Falls back to
     * the stored width when the aspect ratio is missing/unparseable, and distrusts
     * absurd results (>3× or <⅓ of the stored width — bad DAR metadata) to avoid
     * "correcting" a good value into garbage.
     */
    public static Integer displayWidth(Integer storedW, Integer storedH, String dar) {
        if (storedH == null || storedH <= 0) return storedW;
        Double ar = parseAspectRatio(dar);
        if (ar == null || ar <= 0) return storedW;
        long computed = Math.round(ar * storedH);
        if (computed <= 0) return storedW;
        if (storedW != null && storedW > 0) {
            double ratio = (double) computed / storedW;
            if (ratio > 3.0 || ratio < 0.33) return storedW;
        }
        return (int) computed;
    }

    /** Stored pixels differ from display pixels by &gt;2% → non-square pixels (anamorphic). */
    public static boolean isAnamorphic(Integer storedW, Integer displayW) {
        if (storedW == null || displayW == null || storedW <= 0) return false;
        return Math.abs(displayW - storedW) / (double) storedW > 0.02;
    }

    /**
     * Standard resolution tier from effective dimensions. Classifies by width OR
     * height with tolerance, so letterboxed/cropped widescreen keeps its true tier.
     * Returns {@code null} when no usable dimensions are present.
     */
    public static String label(Integer width, Integer height) {
        int w = width  != null ? width  : 0;
        int h = height != null ? height : 0;
        if (w <= 0 && h <= 0) return null;
        if (w >= 7680 || h >= 4320) return "8K";
        if (w >= 3840 || h >= 2160) return "4K";
        if (w >= 2560 || h >= 1440) return "1440p";
        if (w >= 1900 || h >= 1000) return "1080p";
        if (w >= 1260 || h >= 680)  return "720p";
        if (w >= 840  || h >= 460)  return "480p";
        return "SD";
    }

    /**
     * True when a video track's codec is really an attached still image (cover art /
     * embedded poster) rather than a moving-picture stream. MediaInfo reports such
     * "video" tracks with an image codec (JPEG/PNG/MJPEG…); their dimensions are the
     * poster's, not the film's, so they must be excluded when picking the primary video.
     */
    public static boolean isCoverArt(String format) {
        if (format == null || format.isBlank()) return false;
        String f = format.toLowerCase();
        return f.contains("jpeg") || f.contains("jpg") || f.contains("png")
            || f.contains("gif") || f.contains("bmp") || f.contains("mjpeg")
            || f.contains("m-jpeg") || f.contains("webp");
    }

    /** Full resolution picture: raw pixels, corrected display pixels, tier, anamorphic flag. */
    public static ResolutionInfo compute(Integer storedW, Integer storedH, String dar) {
        boolean noDims = (storedW == null || storedW <= 0) && (storedH == null || storedH <= 0);
        if (noDims) return new ResolutionInfo(storedW, storedH, storedW, storedH, null, false);
        Integer dispW = displayWidth(storedW, storedH, dar);
        Integer dispH = storedH;
        boolean anamorphic = isAnamorphic(storedW, dispW);
        String label = label(dispW != null ? dispW : storedW, dispH != null ? dispH : storedH);
        return new ResolutionInfo(storedW, storedH, dispW, dispH, label, anamorphic);
    }

    public record ResolutionInfo(
            Integer rawWidth, Integer rawHeight,
            Integer displayWidth, Integer displayHeight,
            String label, boolean anamorphic) {}
}
