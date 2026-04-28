package com.db.dbworld.app.stream.tag;

import java.util.*;

/**
 * Canonical lookup tables and resolver methods for media file metadata tags.
 *
 * Migrated from com.db.dbworld.services.media.resolver.MediaTagResolver.
 * Updated import of MediaSource to com.db.dbworld.app.stream.tag.MediaSource.
 *
 * All methods are static — this class is a pure utility (no Spring bean).
 */
public final class MediaTagResolver {

    private MediaTagResolver() {}

    /* =========================================================
       BUSINESS CANONICAL MAPS
       ========================================================= */

    // Order = priority
    public static final Map<String, List<String>> HDR_MAP = Map.ofEntries(
            Map.entry("DV HDR", List.of("dolby vision")),
            Map.entry("HDR10+", List.of("2094", "hdr10+")),
            Map.entry("HDR10",  List.of("2086", "hdr10")),
            Map.entry("HLG",    List.of("hlg"))
    );

    public static final Map<String, List<String>> CODEC_MAP = Map.ofEntries(
            Map.entry("H265", List.of("hevc", "h.265", "x265", "hvc1", "hev1")),
            Map.entry("H264", List.of("avc", "h.264", "x264", "avc1")),
            Map.entry("AV1",  List.of("av1")),
            Map.entry("VP9",  List.of("vp9", "vp09")),
            Map.entry("VP8",  List.of("vp8")),
            Map.entry("H266", List.of("vvc", "h.266")),
            Map.entry("MPEG2",List.of("mpeg-2", "mpeg2")),
            Map.entry("MPEG4",List.of("mpeg-4", "mpeg4")),
            Map.entry("PRORES",List.of("prores")),
            Map.entry("VC1",  List.of("vc-1", "vc1")),
            Map.entry("DNXHD",List.of("dnxhd", "dnxhr")),
            Map.entry("CINEFORM",List.of("cineform")),
            Map.entry("THEORA",List.of("theora")),
            Map.entry("JPEG2000",List.of("jpeg 2000", "jpeg2000")),
            Map.entry("DIRAC",List.of("dirac"))
    );

    public static final Map<String, List<String>> AUDIO_CODEC_MAP = Map.ofEntries(
            Map.entry("ATMOS", List.of("atmos")),
            Map.entry("TRUEHD", List.of("truehd")),
            Map.entry("DTS-HD MA", List.of("dts-hd ma", "dts hd master")),
            Map.entry("DTS-HD", List.of("dts-hd")),
            Map.entry("DTS", List.of("dts")),
            Map.entry("EAC3", List.of("e-ac-3", "eac3", "dd+", "dolby digital plus")),
            Map.entry("AC3", List.of("ac-3", "ac3", "dolby digital")),
            Map.entry("HE-AAC", List.of("he-aac")),
            Map.entry("AAC", List.of("aac")),
            Map.entry("FLAC", List.of("flac")),
            Map.entry("OPUS", List.of("opus", "a_opus")),
            Map.entry("MP3", List.of("mp3")),
            Map.entry("PCM", List.of("pcm", "lpcm")),
            Map.entry("VORBIS", List.of("vorbis"))
    );

    public static final Map<Integer, String> BIT_DEPTH_MAP = Map.of(
            8, "8Bit",
            10, "10Bit",
            12, "12Bit",
            16, "16Bit"
    );

    public static final NavigableMap<Integer, String> RESOLUTION_BUCKETS =
            new TreeMap<>(Map.of(
                    3800, "4320p",
                    1700, "2160p",
                    1250, "1440p",
                    750,  "1080p",
                    500,  "720p",
                    350,  "480p",
                    0,    "360p"
            ));

    public static final Map<Integer, String> CHANNEL_MAP = Map.of(
            1, "1.0",
            2, "2.0",
            6, "5.1",
            8, "7.1",
            10, "9.1"
    );

    public static final Map<String, String> VIDEO_PROFILE_MAP = Map.ofEntries(
            Map.entry("main", "Main"),
            Map.entry("main 10", "Main10"),
            Map.entry("high", "High"),
            Map.entry("high 10", "High10"),
            Map.entry("baseline", "Baseline")
    );

    public static final Map<String, String> SUB_FORMAT_MAP = Map.ofEntries(
            Map.entry("srt", "SRT"),
            Map.entry("ass", "ASS"),
            Map.entry("ssa", "SSA"),
            Map.entry("vtt", "VTT"),
            Map.entry("pgs", "PGS"),
            Map.entry("subrip", "SRT")
    );

    /** ffprobe {@code codec_name} → human-readable display label for audio streams. */
    public static final Map<String, String> FFPROBE_AUDIO_CODEC_DISPLAY = Map.ofEntries(
            Map.entry("aac",               "AAC"),
            Map.entry("ac3",               "AC-3"),
            Map.entry("eac3",              "DDP"),
            Map.entry("truehd",            "TrueHD"),
            Map.entry("mlp",               "TrueHD"),
            Map.entry("dts",               "DTS"),
            Map.entry("flac",              "FLAC"),
            Map.entry("mp3",               "MP3"),
            Map.entry("opus",              "Opus"),
            Map.entry("vorbis",            "Vorbis"),
            Map.entry("pcm_s16le",         "PCM"),
            Map.entry("pcm_s24le",         "PCM"),
            Map.entry("pcm_s32le",         "PCM")
    );

    /** ffprobe {@code codec_name} → human-readable display label for subtitle streams. */
    public static final Map<String, String> FFPROBE_SUB_CODEC_DISPLAY = Map.ofEntries(
            Map.entry("subrip",            "SRT"),
            Map.entry("srt",               "SRT"),
            Map.entry("ass",               "ASS"),
            Map.entry("ssa",               "ASS"),
            Map.entry("hdmv_pgs_subtitle", "PGS"),
            Map.entry("dvd_subtitle",      "VOBSUB"),
            Map.entry("webvtt",            "WebVTT"),
            Map.entry("mov_text",          "MP4 Text")
    );

    public static final Map<String, String> SUB_TITLE_MAP = Map.ofEntries(
            Map.entry("sdh", "SDH"),
            Map.entry("cc", "SDH"),
            Map.entry("closed captions", "SDH"),
            Map.entry("signs & songs", "Signs & Songs"),
            Map.entry("signs and songs", "Signs & Songs"),
            Map.entry("commentary", "Commentary"),
            Map.entry("lyrics", "Lyrics")
    );

    public static final Map<String, String> LANGUAGE_MAP = Map.<String, String>ofEntries(
            // Indian
            Map.entry("en", "English"),   Map.entry("eng", "English"),   Map.entry("english", "English"),
            Map.entry("hi", "Hindi"),     Map.entry("hin", "Hindi"),     Map.entry("hindi", "Hindi"),
            Map.entry("gu", "Gujarati"),  Map.entry("guj", "Gujarati"),  Map.entry("gujarati", "Gujarati"),
            Map.entry("mr", "Marathi"),   Map.entry("mar", "Marathi"),   Map.entry("marathi", "Marathi"),
            Map.entry("bn", "Bengali"),   Map.entry("ben", "Bengali"),   Map.entry("bengali", "Bengali"),
            Map.entry("ta", "Tamil"),     Map.entry("tam", "Tamil"),     Map.entry("tamil", "Tamil"),
            Map.entry("te", "Telugu"),    Map.entry("tel", "Telugu"),    Map.entry("telugu", "Telugu"),
            Map.entry("ml", "Malayalam"), Map.entry("mal", "Malayalam"), Map.entry("malayalam", "Malayalam"),
            Map.entry("kn", "Kannada"),   Map.entry("kan", "Kannada"),   Map.entry("kannada", "Kannada"),
            Map.entry("pa", "Punjabi"),   Map.entry("pan", "Punjabi"),   Map.entry("punjabi", "Punjabi"),
            Map.entry("ur", "Urdu"),      Map.entry("urd", "Urdu"),      Map.entry("urdu", "Urdu"),
            Map.entry("or", "Odia"),      Map.entry("ori", "Odia"),      Map.entry("odia", "Odia"),
            Map.entry("oriya", "Odia"),
            Map.entry("as", "Assamese"),  Map.entry("asm", "Assamese"),  Map.entry("assamese", "Assamese"),
            Map.entry("ks", "Kashmiri"),  Map.entry("kas", "Kashmiri"),  Map.entry("kashmiri", "Kashmiri"),
            Map.entry("ne", "Nepali"),    Map.entry("nep", "Nepali"),    Map.entry("nepali", "Nepali"),
            Map.entry("sa", "Sanskrit"),  Map.entry("san", "Sanskrit"),  Map.entry("sanskrit", "Sanskrit"),
            Map.entry("sd", "Sindhi"),    Map.entry("snd", "Sindhi"),    Map.entry("sindhi", "Sindhi"),
            Map.entry("kok", "Konkani"),  Map.entry("konkani", "Konkani"),
            Map.entry("brx", "Bodo"),     Map.entry("bodo", "Bodo"),
            Map.entry("mai", "Maithili"), Map.entry("maithili", "Maithili"),
            Map.entry("sat", "Santhali"), Map.entry("santhali", "Santhali"),
            // Global
            Map.entry("es", "Spanish"),      Map.entry("spa", "Spanish"),      Map.entry("spanish", "Spanish"),
            Map.entry("fr", "French"),       Map.entry("fra", "French"),       Map.entry("fre", "French"),       Map.entry("french", "French"),
            Map.entry("de", "German"),       Map.entry("deu", "German"),       Map.entry("ger", "German"),       Map.entry("german", "German"),
            Map.entry("it", "Italian"),      Map.entry("ita", "Italian"),      Map.entry("italian", "Italian"),
            Map.entry("pt", "Portuguese"),   Map.entry("por", "Portuguese"),   Map.entry("portuguese", "Portuguese"),
            Map.entry("ru", "Russian"),      Map.entry("rus", "Russian"),      Map.entry("russian", "Russian"),
            Map.entry("ja", "Japanese"),     Map.entry("jpn", "Japanese"),     Map.entry("japanese", "Japanese"),
            Map.entry("ko", "Korean"),       Map.entry("kor", "Korean"),       Map.entry("korean", "Korean"),
            Map.entry("zh", "Chinese"),      Map.entry("zho", "Chinese"),      Map.entry("chi", "Chinese"),      Map.entry("chinese", "Chinese"),
            Map.entry("ar", "Arabic"),       Map.entry("ara", "Arabic"),       Map.entry("arabic", "Arabic"),
            Map.entry("tr", "Turkish"),      Map.entry("tur", "Turkish"),      Map.entry("turkish", "Turkish"),
            Map.entry("th", "Thai"),         Map.entry("tha", "Thai"),         Map.entry("thai", "Thai"),
            Map.entry("vi", "Vietnamese"),   Map.entry("vie", "Vietnamese"),   Map.entry("vietnamese", "Vietnamese"),
            Map.entry("id", "Indonesian"),   Map.entry("ind", "Indonesian"),   Map.entry("indonesian", "Indonesian"),
            Map.entry("ms", "Malay"),        Map.entry("msa", "Malay"),        Map.entry("malay", "Malay"),
            Map.entry("fa", "Persian"),      Map.entry("per", "Persian"),      Map.entry("fas", "Persian"),      Map.entry("persian", "Persian"),
            Map.entry("he", "Hebrew"),       Map.entry("heb", "Hebrew"),       Map.entry("hebrew", "Hebrew"),
            Map.entry("pl", "Polish"),       Map.entry("pol", "Polish"),       Map.entry("polish", "Polish"),
            Map.entry("nl", "Dutch"),        Map.entry("nld", "Dutch"),        Map.entry("dut", "Dutch"),        Map.entry("dutch", "Dutch"),
            Map.entry("sv", "Swedish"),      Map.entry("swe", "Swedish"),      Map.entry("swedish", "Swedish"),
            Map.entry("no", "Norwegian"),    Map.entry("nor", "Norwegian"),    Map.entry("norwegian", "Norwegian"),
            Map.entry("fi", "Finnish"),      Map.entry("fin", "Finnish"),      Map.entry("finnish", "Finnish"),
            Map.entry("da", "Danish"),       Map.entry("dan", "Danish"),       Map.entry("danish", "Danish"),
            Map.entry("el", "Greek"),        Map.entry("ell", "Greek"),        Map.entry("greek", "Greek"),
            Map.entry("uk", "Ukrainian"),    Map.entry("ukr", "Ukrainian"),    Map.entry("ukrainian", "Ukrainian"),
            // Fallback
            Map.entry("mul", "Multiple"),    Map.entry("multi", "Multiple"),   Map.entry("various", "Multiple"),
            Map.entry("und", "Unknown"),     Map.entry("unknown", "Unknown"),  Map.entry("n/a", "Unknown"),
            Map.entry("", "Unknown")
    );

    /* =========================================================
       FORMAT EXTENSIONS
       ========================================================= */

    public static final Map<String, String> FORMAT_EXTENSION_MAP = Map.ofEntries(
            Map.entry("mpeg-4", ".mp4"),
            Map.entry("mp4", ".mp4"),
            Map.entry("mov", ".mp4"),
            Map.entry("matroska", ".mkv"),
            Map.entry("mkv", ".mkv"),
            Map.entry("webm", ".webm"),
            Map.entry("avi", ".avi"),
            Map.entry("mpeg-ts", ".ts"),
            Map.entry("bdav", ".m2ts"),
            Map.entry("wmv", ".wmv"),
            Map.entry("flv", ".flv"),
            Map.entry("3gpp", ".3gp"),
            Map.entry("ogg", ".ogv"),
            Map.entry("rmvb", ".rmvb"),
            Map.entry("mxf", ".mxf"),
            Map.entry("vob", ".vob")
    );

    /* =========================================================
       PRECOMPILED REVERSE MAPS (FAST)
       ========================================================= */

    private static final Map<String, String> HDR_REVERSE        = buildReverse(HDR_MAP);
    private static final Map<String, String> CODEC_REVERSE      = buildReverse(CODEC_MAP);
    private static final Map<String, String> AUDIO_CODEC_REVERSE = buildReverse(AUDIO_CODEC_MAP);

    /* =========================================================
       PUBLIC RESOLVERS
       ========================================================= */

    public static String resolveHdr(String raw)        { return resolve(raw, HDR_REVERSE); }
    public static String resolveVideoCodec(String raw) { return resolve(raw, CODEC_REVERSE); }
    public static String resolveAudioCodec(String raw) { return resolve(raw, AUDIO_CODEC_REVERSE); }

    public static String resolveLanguage(String raw) {
        if (raw == null) return "Unknown";
        return LANGUAGE_MAP.getOrDefault(raw.toLowerCase(), "Unknown");
    }

    public static String resolveResolution(Integer height) {
        if (height == null) return null;
        return RESOLUTION_BUCKETS.floorEntry(height).getValue();
    }

    public static String resolveAudioCodecDisplay(String ffprobeCodec) {
        if (ffprobeCodec == null || ffprobeCodec.isBlank()) return "";
        return FFPROBE_AUDIO_CODEC_DISPLAY.getOrDefault(ffprobeCodec.toLowerCase(), ffprobeCodec.toUpperCase());
    }

    public static String resolveSubCodecDisplay(String ffprobeCodec) {
        if (ffprobeCodec == null || ffprobeCodec.isBlank()) return "";
        return FFPROBE_SUB_CODEC_DISPLAY.getOrDefault(ffprobeCodec.toLowerCase(), ffprobeCodec.toUpperCase());
    }

    public static String resolveChannelLayout(int channels, String channelLayout) {
        if (channelLayout != null && !channelLayout.isBlank()) {
            String norm = channelLayout.toLowerCase().replace("(side)", "").trim();
            return switch (norm) {
                case "mono"   -> "Mono";
                case "stereo" -> "Stereo";
                case "5.1"    -> "5.1";
                case "6.1"    -> "6.1";
                case "7.1"    -> "7.1";
                case "4.0"    -> "4.0";
                default -> channelLayout;
            };
        }
        return switch (channels) {
            case 1 -> "Mono";
            case 2 -> "Stereo";
            case 6 -> "5.1";
            case 7 -> "6.1";
            case 8 -> "7.1";
            default -> channels > 0 ? channels + "ch" : "";
        };
    }

    public static String resolveExtension(String format) {
        if (format == null) return null;
        return FORMAT_EXTENSION_MAP.get(format.toLowerCase());
    }

    public static MediaSource detectSource(String filename) {
        if (filename == null) return MediaSource.UNKNOWN;
        String upper = filename.toUpperCase();
        for (MediaSource source : MediaSource.values()) {
            if (source == MediaSource.UNKNOWN) continue;
            for (String token : source.getTokens()) {
                if (matchesToken(upper, token)) return source;
            }
        }
        return MediaSource.UNKNOWN;
    }

    /* =========================================================
       CORE ENGINE
       ========================================================= */

    private static Map<String, String> buildReverse(Map<String, List<String>> source) {
        Map<String, String> reverse = new HashMap<>();
        for (var entry : source.entrySet()) {
            for (String token : entry.getValue()) {
                reverse.put(token.toLowerCase(), entry.getKey());
            }
        }
        return Map.copyOf(reverse);
    }

    private static String resolve(String raw, Map<String, String> reverse) {
        if (raw == null || raw.isBlank()) return null;
        String normalized = raw.toLowerCase();
        for (String token : reverse.keySet()) {
            if (normalized.contains(token)) return reverse.get(token);
        }
        return null;
    }

    private static boolean matchesToken(String text, String token) {
        return text.matches(".*(^|[ ._\\-\\[\\]])" + token + "($|[ ._\\-\\[\\]]).*");
    }
}
