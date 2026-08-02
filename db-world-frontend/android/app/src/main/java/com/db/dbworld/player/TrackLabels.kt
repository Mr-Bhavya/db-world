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

/** A selectable episode for the native panel (JS owns the full object; native shows label). */
data class PlayerEpisode(
    val fileId: String,
    val label: String,
    val name: String = "",
    val overview: String = "",
    val still: String = "",
    val runtime: String = "",
)

/** A quality variant (URL already resolved by JS). */
data class PlayerVariant(val url: String, val label: String)
