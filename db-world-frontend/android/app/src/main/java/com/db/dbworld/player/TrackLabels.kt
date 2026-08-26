package com.db.dbworld.player

import java.util.Locale

/** A selectable track for the Compose menus. */
data class PlayerTrack(val id: Int, val label: String)

/** Human language name from an ISO code (ported from HybridPlayerPlugin.langName). */
fun langName(code: String?): String {
    if (code.isNullOrEmpty()) return "Unknown"
    return when (code.lowercase()) {
        "hin", "hi" -> "Hindi"
        "eng", "en" -> "English"
        "tam", "ta" -> "Tamil"
        "tel", "te" -> "Telugu"
        "mal", "ml" -> "Malayalam"
        "kan", "kn" -> "Kannada"
        "ben", "bn" -> "Bengali"
        "mar", "mr" -> "Marathi"
        "pan", "pa" -> "Punjabi"
        "guj", "gu" -> "Gujarati"
        "urd", "ur" -> "Urdu"
        "spa", "es" -> "Spanish"
        "fra", "fre", "fr" -> "French"
        "deu", "ger", "de" -> "German"
        "jpn", "ja" -> "Japanese"
        "kor", "ko" -> "Korean"
        "zho", "chi", "zh" -> "Chinese"
        else -> try { Locale(code).displayLanguage } catch (e: Exception) { code }
    }
}

/** Short codec display name from a sampleMimeType (ported from HybridPlayerPlugin.codecName). */
fun codecName(mime: String?): String? {
    if (mime == null) return null
    val m = mime.lowercase()
    return when {
        m.contains("eac3") || m.contains("e-ac3") -> "E-AC3"
        m.contains("ac4") -> "AC4"
        m.contains("ac3") -> "AC3"
        m.contains("truehd") || m.contains("true-hd") -> "TrueHD"
        m.contains("dts") -> "DTS"
        m.contains("mp4a") || m.contains("aac") -> "AAC"
        m.contains("opus") -> "Opus"
        m.contains("flac") -> "FLAC"
        m.contains("mpeg") || m.contains("mp3") -> "MP3"
        m.contains("vorbis") -> "Vorbis"
        m.contains("raw") || m.contains("pcm") -> "PCM"
        else -> mime.substringAfter('/', mime).uppercase()
    }
}

/** Builds the audio-track label: "Hindi · E-AC3 · 5.1" style, skipping unknown parts. */
fun audioLabel(language: String?, codec: String?, channels: Int, title: String?): String {
    val parts = ArrayList<String>()
    (if (!language.isNullOrEmpty()) langName(language) else title)?.let { parts.add(it) }
    codec?.let { parts.add(it) }
    if (channels >= 6) parts.add("5.1") else if (channels == 2) parts.add("Stereo")
    return if (parts.isEmpty()) "Audio" else parts.joinToString(" · ")
}

/** Builds the subtitle-track label. */
fun subtitleLabel(language: String?, title: String?): String =
    if (!language.isNullOrEmpty()) langName(language) else (title ?: "Subtitle")

/** Short video-codec display name from a sampleMimeType ("video/av01" -> "AV1"). */
fun videoCodecName(mime: String?): String {
    if (mime == null) return "—"
    val m = mime.lowercase()
    return when {
        m.contains("av01") || m.contains("av1") -> "AV1"
        m.contains("hevc") || m.contains("h265") || m.contains("dolby-vision") -> "HEVC"
        m.contains("avc") || m.contains("h264") -> "H.264"
        m.contains("vp9") -> "VP9"
        m.contains("vp8") -> "VP8"
        m.contains("mp4v") || m.contains("mpeg4") -> "MPEG-4"
        else -> mime.substringAfter('/', mime).uppercase()
    }
}

/** SDR / HDR10 / HLG from a Media3 colorTransfer (C.COLOR_TRANSFER_*). */
fun dynamicRangeName(colorTransfer: Int?): String = when (colorTransfer) {
    null, androidx.media3.common.Format.NO_VALUE -> "—"
    androidx.media3.common.C.COLOR_TRANSFER_ST2084 -> "HDR10"
    androidx.media3.common.C.COLOR_TRANSFER_HLG -> "HLG"
    else -> "SDR"
}

/** A selectable episode for the native panel (JS owns the full object; native shows label). */
data class PlayerEpisode(
    val fileId: String,
    val label: String,
    val name: String = "",
    val overview: String = "",
    val still: String = "",
    val runtime: String = "",
    /** How much of this episode has been watched, 0..1. 0 hides the bar. */
    val progress: Float = 0f,
)

/**
 * A quality variant (URL already resolved by JS). [mediaFileId] marks the running one;
 * [detail] is the geometry + bitrate line under the label, since the label is only a tier.
 */
data class PlayerVariant(
    val url: String,
    val label: String,
    val mediaFileId: String = "",
    val detail: String = "",
)

/**
 * One "label: value" row of the Info sheet, pre-formatted by JS from the file's MediaInfo.
 * ExoPlayer only knows what it is decoding — container, bitrates, colour primaries and HDR
 * format all come from the API, so JS formats them once and both players print the same text.
 */
data class PlayerSpec(val name: String, val detail: String)

/** A tech badge for the pause card (4K / HDR10 / ATMOS / H.265). [color] is "#rrggbb". */
data class PlayerBadge(val label: String, val color: String, val filled: Boolean)

/**
 * Scrub-preview storyboard: one sprite sheet at [url], a [cols]×[rows] grid of [tileW]×[tileH]
 * thumbnails, one every [intervalMs] ms, [count] total. Tile index = floor(posMs/intervalMs).
 */
data class PlayerStoryboard(
    val url: String,
    val intervalMs: Long,
    val cols: Int,
    val rows: Int,
    val tileW: Int,
    val tileH: Int,
    val count: Int,
)
