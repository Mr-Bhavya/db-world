package com.db.dbworld.app.media.enrichment;

import com.db.dbworld.app.stream.tag.MediaTagResolver;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Resolves the effective {@link TrackFilter} for a media file by probing
 * its actual track languages via MediaInfo before FFmpeg runs.
 *
 * Priority language order: Hindi → English → Gujarati.
 * - If any priority language exists in the file: filter audio/subtitles to
 *   those priority languages only, with the first matched priority language
 *   as the default audio.
 * - If NO priority language exists: return {@code null} (keep all tracks).
 * - If the caller already provided a non-empty filter, use it as-is.
 *
 * Language codes are kept exactly as MediaInfo reports them (2-char or 3-char)
 * so FFmpeg stream-mapping specifiers match the actual container metadata.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class SmartTrackFilterService {

    /** Priority languages as canonical full names, in preference order. */
    private static final List<String> PRIORITY_LANG_NAMES = List.of("Hindi", "English", "Gujarati");

    private final ProcessExecutor processExecutor;
    private final ObjectMapper    objectMapper;

    /**
     * @param mediaFile  the input media file to probe
     * @param userFilter the caller-supplied filter (may be null or empty)
     * @return effective TrackFilter to use, or {@code null} if no filtering is needed
     */
    public TrackFilter resolve(Path mediaFile, TrackFilter userFilter) {
        if (userFilter != null && userFilter.hasAnyFilter()) {
            return userFilter;
        }

        TrackLanguages langs = probeLanguages(mediaFile);

        // Build lists using the ORIGINAL codes from the file (not normalized) so
        // FFmpeg -map language specifiers match the container metadata exactly.
        List<String> keepAudio = buildCodeList(langs.audio());
        List<String> keepSubs  = buildCodeList(langs.subtitles());

        if (keepAudio.isEmpty() && keepSubs.isEmpty()) {
            log.debug("No priority languages found in {} — track filter skipped", mediaFile.getFileName());
            return null;
        }

        log.debug("Smart filter for {}: audio={}, subs={}", mediaFile.getFileName(), keepAudio, keepSubs);

        return TrackFilter.builder()
                .keepAudioLanguages(keepAudio.isEmpty() ? null : keepAudio)
                .keepSubtitleLanguages(keepSubs.isEmpty() ? null : keepSubs)
                .defaultAudioLanguage(keepAudio.isEmpty() ? null : keepAudio.getFirst())
                .noDefaultSubtitle(true)
                .audioStreamCounts(keepAudio.isEmpty() ? null : buildCountMap(keepAudio, langs.audioCounts()))
                .subStreamCounts(keepSubs.isEmpty() ? null : buildCountMap(keepSubs, langs.subCounts()))
                .build();
    }

    // ──────────────────────────────────────────────────────────────────────

    /**
     * Returns a list of original language codes for priority languages found in the map,
     * in priority order.
     */
    private List<String> buildCodeList(Map<String, String> resolvedToOriginal) {
        return PRIORITY_LANG_NAMES.stream()
                .filter(resolvedToOriginal::containsKey)
                .map(resolvedToOriginal::get)
                .collect(Collectors.toList());
    }

    /**
     * Builds a language-code → stream-count map for the kept codes only.
     * Falls back to 1 if a code has no count entry (shouldn't happen in practice).
     */
    private Map<String, Integer> buildCountMap(List<String> keepCodes, Map<String, Integer> rawCounts) {
        Map<String, Integer> result = new LinkedHashMap<>();
        for (String code : keepCodes) {
            result.put(code, rawCounts.getOrDefault(code, 1));
        }
        return result;
    }

    /**
     * Probes the file via ffprobe and collects track language codes.
     *
     * ffprobe is used (not MediaInfo) because it returns the EXACT language tags
     * as stored in the container — the same values FFmpeg's stream specifiers
     * (e.g. {@code -map 0:a:m:language:hin?}) will match at mux time.
     *
     * MediaInfo normalises codes (e.g. reports "hi" for MKV tracks tagged "hin"),
     * which caused a mismatch: the generated map command contained "hi" but the
     * container held "hin", so no audio stream was ever included.
     *
     * Returns a map of resolved-full-name → original-code-from-file for each
     * track type. First occurrence of each resolved language wins.
     */
    private TrackLanguages probeLanguages(Path file) {
        Map<String, String>  audioLangs   = new LinkedHashMap<>(); // resolvedName → originalCode (first seen)
        Map<String, String>  subLangs     = new LinkedHashMap<>();
        Map<String, Integer> audioCounts  = new LinkedHashMap<>(); // originalCode → stream count
        Map<String, Integer> subCounts    = new LinkedHashMap<>();
        try {
            String json = processExecutor.runFfprobeStreamsJson(file);
            JsonNode root    = objectMapper.readTree(json);
            JsonNode streams = root.path("streams");
            for (JsonNode stream : streams) {
                String codecType = stream.path("codec_type").asText("").trim();
                String lang      = stream.path("tags").path("language").asText("").trim();
                if (lang.isBlank()) continue;
                String resolved = MediaTagResolver.resolveLanguage(lang.toLowerCase());
                if ("Unknown".equalsIgnoreCase(resolved)) continue;
                if ("audio".equalsIgnoreCase(codecType)) {
                    audioLangs.putIfAbsent(resolved, lang);
                    audioCounts.merge(lang, 1, Integer::sum);
                } else if ("subtitle".equalsIgnoreCase(codecType)) {
                    subLangs.putIfAbsent(resolved, lang);
                    subCounts.merge(lang, 1, Integer::sum);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to probe track languages for {}: {}", file.getFileName(), e.getMessage());
        }
        return new TrackLanguages(audioLangs, subLangs, audioCounts, subCounts);
    }

    private record TrackLanguages(
            Map<String, String>  audio,
            Map<String, String>  subtitles,
            Map<String, Integer> audioCounts,
            Map<String, Integer> subCounts
    ) {}
}
