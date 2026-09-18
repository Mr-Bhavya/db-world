package com.db.dbworld.app.live.service;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extended-M3U parser. Turns playlist text into {@link ParsedChannel} rows.
 *
 * <p>The format is a sequence of {@code #EXTINF} headers, each optionally followed by
 * directive lines, then the stream URL:
 *
 * <pre>
 * #EXTM3U
 * #EXTINF:-1 tvg-id="AlJazeera.qa" tvg-logo="https://…" group-title="News",Al Jazeera
 * #EXTVLCOPT:http-user-agent=Mozilla/5.0
 * https://cdn.example.com/aljazeera/index.m3u8
 * </pre>
 *
 * <p>A duration of {@code -1} means the entry has no end, which is how a live channel is
 * distinguished from a VOD item. That distinction matters downstream: an entry with a
 * finite duration is a recording, not a channel, and is skipped.
 */
@Component
public class M3uParser {

    /** Guards against a hostile or mistyped URL streaming gigabytes into memory. */
    public static final int MAX_PLAYLIST_BYTES = 15 * 1024 * 1024;

    private static final Pattern ATTRIBUTE = Pattern.compile("([A-Za-z][\\w-]*)=\"([^\"]*)\"");
    private static final Pattern NON_SLUG  = Pattern.compile("[^a-z0-9]+");

    /**
     * {@code group-title} holds a LIST of categories, not one label. iptv-org writes
     * {@code group-title="Culture;Family"} for a channel that is both, and treating the
     * whole string as opaque turns 30 real categories into 184 meaningless combinations.
     */
    private static final Pattern CATEGORY_SEPARATOR = Pattern.compile("[;|]");

    /**
     * The resolution playlists append to a channel name: {@code Sony Max HD (1080p)}.
     *
     * <p>It belongs to the STREAM, not the channel — iptv-org lists the same channel at
     * several qualities as separate entries sharing one {@code tvg-id}, which merge into
     * one channel with several sources. Left in the name it would both pick an arbitrary
     * winner for the channel title and make the player caption read "(1080p)" while
     * playing a 576p fallback.
     */
    private static final Pattern QUALITY_SUFFIX =
            Pattern.compile("\\s*\\((\\d{3,4}[pi])\\)\\s*$", Pattern.CASE_INSENSITIVE);

    /**
     * The country code trailing a {@code tvg-id}: {@code SonyMax.in}, {@code AlJazeera.qa}.
     * A fallback for playlists the iptv-org enrichment does not know.
     */
    private static final Pattern TVG_ID_COUNTRY = Pattern.compile("\\.([a-zA-Z]{2})$");

    /** Leading words that identify no brand on their own. */
    private static final Set<String> WEAK_BRAND_TOKENS =
            Set.of("the", "tv", "channel", "canal", "canale", "kanal", "hd", "sd", "uhd", "4k");

    /**
     * Playlists spell "no category" as a literal word rather than omitting the attribute.
     * iptv-org uses {@code Undefined} for ~1,500 channels; shown verbatim it becomes the
     * second-largest "category" on the page.
     */
    private static final Set<String> NON_CATEGORIES =
            Set.of("undefined", "unknown", "none", "n/a", "no category", "uncategorized", "uncategorised");

    /**
     * One channel as it appeared in the playlist. Everything but {@code url} may be blank —
     * plenty of real playlists carry nothing but a name.
     *
     * @param channelKey merge key across playlists: tvg-id when present, else a name slug
     */
    public record ParsedChannel(
            String channelKey,
            String name,
            String tvgId,
            String logoUrl,
            /** The raw {@code group-title}, kept verbatim as the import record. */
            String groupTitle,
            /** {@code groupTitle} split into real categories — what the UI filters on. */
            List<String> categories,
            /** Resolution lifted out of the name ("1080p"), or null when unstated. */
            String quality,
            /** ISO country code from the tvg-id suffix, uppercased, or null. */
            String country,
            /** First meaningful word of the name — "Sony", "Zee", "Star". */
            String brand,
            String url,
            String userAgent,
            String referer
    ) {}

    /**
     * Parse playlist text.
     *
     * <p>Entries are deduplicated by {@code (channelKey, url)} so a playlist that lists the
     * same feed twice contributes one source, while the same channel offered at two
     * different URLs contributes two — which is exactly the input failover needs.
     *
     * @param text raw playlist contents
     * @return channels in playlist order; empty when nothing parsed
     */
    public List<ParsedChannel> parse(String text) {
        if (text == null || text.isBlank()) return List.of();

        // Pre-size from the line count: a 50k-channel playlist otherwise spends its whole
        // parse growing an ArrayList.
        var lines = text.split("\\r?\\n");
        // Keyed on (channelKey, url) as a composite rather than a delimited string: any
        // separator character has to be one a URL cannot contain, and picking one is how a
        // raw NUL ended up embedded in this file, which made git treat it as binary.
        Map<List<String>, ParsedChannel> out = LinkedHashMap.newLinkedHashMap(Math.max(16, lines.length / 2));

        String name = null, tvgId = null, logo = null, group = null, userAgent = null, referer = null;
        boolean live = false;

        for (var raw : lines) {
            var line = raw.strip();
            if (line.isEmpty()) continue;

            if (line.startsWith("#EXTINF:")) {
                var header = parseExtInf(line.substring("#EXTINF:".length()));
                live       = header.live();
                name       = header.name();
                var attrs  = header.attributes();
                tvgId      = firstNonBlank(attrs.get("tvg-id"), attrs.get("tvg-chno"));
                logo       = firstNonBlank(attrs.get("tvg-logo"), attrs.get("logo"));
                group      = firstNonBlank(attrs.get("group-title"), attrs.get("group"));
                if (isBlank(name)) name = firstNonBlank(attrs.get("tvg-name"), tvgId);
                userAgent  = null;
                referer    = null;
                continue;
            }

            // #EXTGRP is the older way of stating the group and still shows up on its own line.
            if (line.startsWith("#EXTGRP:")) {
                if (isBlank(group)) group = line.substring("#EXTGRP:".length()).strip();
                continue;
            }

            // Per-entry playback headers. Both the VLC and Kodi spellings appear in the wild,
            // and a stream whose CDN checks them is unplayable without them.
            if (line.startsWith("#EXTVLCOPT:") || line.startsWith("#KODIPROP:")) {
                var opt   = line.substring(line.indexOf(':') + 1);
                var eq    = opt.indexOf('=');
                if (eq <= 0) continue;
                var key   = opt.substring(0, eq).strip().toLowerCase(Locale.ROOT);
                var value = opt.substring(eq + 1).strip();
                if (key.endsWith("user-agent"))                      userAgent = value;
                else if (key.endsWith("referrer") || key.endsWith("referer")) referer = value;
                continue;
            }

            if (line.startsWith("#")) continue;   // #EXTM3U, comments, directives we ignore

            // A bare line following an #EXTINF is the stream URL.
            if (name == null) continue;           // URL with no header — nothing to name it
            if (live && isPlayable(line)) {
                var key = channelKey(tvgId, name);
                var cleanName = stripQuality(name);
                out.putIfAbsent(List.of(key, line), new ParsedChannel(
                        key, cleanName, blankToNull(tvgId), blankToNull(logo),
                        blankToNull(group), splitCategories(group),
                        qualityOf(name), countryOf(tvgId), brandOf(cleanName), line,
                        blankToNull(userAgent), blankToNull(referer)));
            }
            name = null; tvgId = null; logo = null; group = null; userAgent = null; referer = null;
        }
        return new ArrayList<>(out.values());
    }

    /** The {@code #EXTINF:} payload, split into duration, attributes and display name. */
    private record ExtInf(boolean live, Map<String, String> attributes, String name) {}

    /**
     * Split {@code -1 tvg-id="x" group-title="News, Sport",Channel Name}.
     *
     * <p>The name begins after the first comma that is NOT inside quotes. Taking the first
     * comma outright would truncate at {@code group-title="News, Sport"}, and taking the
     * last would swallow a comma in the channel's own name.
     */
    private ExtInf parseExtInf(String payload) {
        var inQuotes = false;
        var split    = -1;
        for (var i = 0; i < payload.length(); i++) {
            var c = payload.charAt(i);
            if (c == '"') inQuotes = !inQuotes;
            else if (c == ',' && !inQuotes) { split = i; break; }
        }
        var head = split >= 0 ? payload.substring(0, split) : payload;
        var name = split >= 0 ? payload.substring(split + 1).strip() : "";

        // Duration is the leading token; -1 (or any negative) means live.
        var durationToken = head.strip().split("\\s+", 2)[0];
        var live = true;
        try {
            live = Double.parseDouble(durationToken) < 0;
        } catch (NumberFormatException ignored) {
            // No parseable duration. Malformed, but every such entry seen in the wild is a
            // channel, so treat it as live rather than dropping it.
        }

        Map<String, String> attrs = new LinkedHashMap<>();
        var m = ATTRIBUTE.matcher(head);
        while (m.find()) attrs.put(m.group(1).toLowerCase(Locale.ROOT), m.group(2));

        return new ExtInf(live, attrs, name);
    }

    /**
     * Merge key for a channel. tvg-id is the identifier the guide also keys on, so it wins;
     * a name slug is the fallback, which is why "Star Sports 1" and "STAR Sports-1" merge.
     */
    public String channelKey(String tvgId, String name) {
        if (!isBlank(tvgId)) return tvgId.strip().toLowerCase(Locale.ROOT);
        var slug = NON_SLUG.matcher(String.valueOf(name).toLowerCase(Locale.ROOT)).replaceAll("-");
        slug = slug.replaceAll("^-+|-+$", "");
        return slug.isEmpty() ? "channel" : slug;
    }

    /**
     * Split a raw {@code group-title} into categories.
     *
     * <p>Separators are {@code ;} and {@code |}. Blanks and the playlists' various
     * spellings of "no category" are dropped, and duplicates are removed
     * case-insensitively while keeping the first spelling seen — so a playlist carrying
     * both "News" and "news" contributes one category, not two.
     *
     * @return the categories, in playlist order; empty when there are none
     */
    public List<String> splitCategories(String groupTitle) {
        if (isBlank(groupTitle)) return List.of();

        Map<String, String> byLower = new LinkedHashMap<>();
        for (var part : CATEGORY_SEPARATOR.split(groupTitle)) {
            var value = part.strip();
            if (value.isEmpty()) continue;
            var lower = value.toLowerCase(Locale.ROOT);
            if (NON_CATEGORIES.contains(lower)) continue;
            byLower.putIfAbsent(lower, value);
        }
        return List.copyOf(byLower.values());
    }

    /** The resolution a name ends with, e.g. {@code Sony Max HD (1080p)} -> {@code 1080p}. */
    public String qualityOf(String name) {
        if (isBlank(name)) return null;
        var m = QUALITY_SUFFIX.matcher(name.strip());
        return m.find() ? m.group(1).toLowerCase(Locale.ROOT) : null;
    }

    /** The same name with that resolution removed, so the channel title is the channel. */
    public String stripQuality(String name) {
        if (isBlank(name)) return String.valueOf(name).strip();
        return QUALITY_SUFFIX.matcher(name.strip()).replaceAll("").strip();
    }

    /** ISO country code trailing the tvg-id, uppercased. Null when there is no tvg-id. */
    public String countryOf(String tvgId) {
        if (isBlank(tvgId)) return null;
        var m = TVG_ID_COUNTRY.matcher(tvgId.strip());
        return m.find() ? m.group(1).toUpperCase(Locale.ROOT) : null;
    }

    /**
     * The brand a channel belongs to, taken as the first meaningful word of its name.
     *
     * <p>Chosen over the iptv-org {@code network} field on purpose: that covers only ~13%
     * of channels and splits the very brands people search for — Zee lands under both "Z"
     * and "Zee Media", Star under "Star Sports", "Star TV" and "JioStar". The first word
     * groups all 21 Sony channels and every Star channel the way a viewer expects.
     *
     * <p>A WORD, not a prefix: "Starlight TV" must not be filed under Star.
     */
    public String brandOf(String name) {
        if (isBlank(name)) return null;
        for (var raw : name.strip().split("\\s+")) {
            var word = raw.replaceAll("[^\\p{L}\\p{N}]", "");
            if (word.length() < 2) continue;
            if (WEAK_BRAND_TOKENS.contains(word.toLowerCase(Locale.ROOT))) continue;
            // Title-case so "SONY"/"sony"/"Sony" are one brand rather than three.
            return word.substring(0, 1).toUpperCase(Locale.ROOT) + word.substring(1).toLowerCase(Locale.ROOT);
        }
        return null;
    }

    /**
     * Whether a player could open this URL at all. RTMP and RTSP parse fine but neither a
     * browser nor our web adapter can play them, so they are dropped at import rather than
     * shown as channels that silently fail.
     */
    private boolean isPlayable(String url) {
        var lower = url.toLowerCase(Locale.ROOT);
        return lower.startsWith("http://") || lower.startsWith("https://");
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static String blankToNull(String s) { return isBlank(s) ? null : s.strip(); }

    private static String firstNonBlank(String a, String b) { return isBlank(a) ? b : a; }
}
