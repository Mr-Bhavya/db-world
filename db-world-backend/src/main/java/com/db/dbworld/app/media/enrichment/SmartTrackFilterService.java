package com.db.dbworld.app.media.enrichment;

import com.db.dbworld.core.processor.ProcessExecutor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Resolves the effective {@link TrackFilter} for a media file by probing
 * its actual track languages via MediaInfo before FFmpeg runs.
 *
 * Priority language order: Hindi (hin) → English (eng) → Gujarati (guj).
 * - If any priority language exists in the file: filter audio/subtitles to
 *   those priority languages only, with Hindi as default audio.
 * - If NO priority language exists: return {@code null} (keep all tracks).
 * - If the caller already provided a non-empty filter, use it as-is.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SmartTrackFilterService {

    private static final List<String> PRIORITY_LANGS = List.of("hin", "eng", "guj");

    private final ProcessExecutor processExecutor;
    private final ObjectMapper    objectMapper;

    /**
     * @param mediaFile  the input media file to probe
     * @param userFilter the caller-supplied filter (may be null or empty)
     * @return effective TrackFilter to use, or {@code null} if no filtering is needed
     */
    public TrackFilter resolve(Path mediaFile, TrackFilter userFilter) {
        // Honour an explicit user-provided filter
        if (userFilter != null && userFilter.hasAnyFilter()) {
            return userFilter;
        }

        TrackLanguages langs = probeLanguages(mediaFile);

        List<String> keepAudio = PRIORITY_LANGS.stream()
                .filter(langs.audio()::contains)
                .collect(Collectors.toList());

        List<String> keepSubs = PRIORITY_LANGS.stream()
                .filter(langs.subtitles()::contains)
                .collect(Collectors.toList());

        if (keepAudio.isEmpty() && keepSubs.isEmpty()) {
            log.debug("No priority languages found in {} — track filter skipped", mediaFile.getFileName());
            return null;
        }

        log.debug("Smart filter for {}: audio={}, subs={}", mediaFile.getFileName(), keepAudio, keepSubs);

        return TrackFilter.builder()
                .keepAudioLanguages(keepAudio.isEmpty() ? null : keepAudio)
                .keepSubtitleLanguages(keepSubs.isEmpty() ? null : keepSubs)
                .defaultAudioLanguage(keepAudio.contains("hin") ? "hin"
                        : keepAudio.isEmpty() ? null : keepAudio.get(0))
                .noDefaultSubtitle(true)
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────

    private TrackLanguages probeLanguages(Path file) {
        Set<String> audioLangs = new HashSet<>();
        Set<String> subLangs   = new HashSet<>();
        try {
            String json = processExecutor.runMediaInfoCommand(file);
            JsonNode root   = objectMapper.readTree(json);
            JsonNode tracks = root.path("media").path("track");
            for (JsonNode track : tracks) {
                String type = track.path("@type").asText("");
                String lang = track.path("Language").asText("").toLowerCase().trim();
                if (lang.isBlank()) continue;
                lang = normaliseIso(lang);
                if ("Audio".equals(type)) audioLangs.add(lang);
                else if ("Text".equals(type)) subLangs.add(lang);
            }
        } catch (Exception e) {
            log.warn("Failed to probe track languages for {}: {}", file.getFileName(), e.getMessage());
        }
        return new TrackLanguages(audioLangs, subLangs);
    }

    /**
     * Normalises ISO 639-1 (2-letter) codes to ISO 639-2/B (3-letter).
     * MediaInfo sometimes returns the shorter form.
     */
    private String normaliseIso(String code) {
        return switch (code) {
            case "hi"  -> "hin";
            case "en"  -> "eng";
            case "gu"  -> "guj";
            case "ta"  -> "tam";
            case "te"  -> "tel";
            case "ja"  -> "jpn";
            case "ko"  -> "kor";
            case "zh"  -> "chi";
            case "fr"  -> "fra";
            case "es"  -> "spa";
            default    -> code;
        };
    }

    private record TrackLanguages(Set<String> audio, Set<String> subtitles) {}
}
