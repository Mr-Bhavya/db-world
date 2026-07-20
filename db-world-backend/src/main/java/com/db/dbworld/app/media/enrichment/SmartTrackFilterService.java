package com.db.dbworld.app.media.enrichment;

import com.db.dbworld.app.stream.tag.MediaTagResolver;
import com.db.dbworld.core.processor.ProcessExecutor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
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
        log.debug("resolve mediaFile={} userFilter={}",
                mediaFile != null ? mediaFile.getFileName() : null,
                userFilter != null && userFilter.hasAnyFilter());
        TrackLanguages langs = probeLanguages(mediaFile);

        if (userFilter != null && userFilter.hasAnyFilter()) {
            // Preserve the user's filter settings; only augment with track infos for title generation
            log.info("Using user-supplied track filter for {} (keepAudio={}, keepSubs={})",
                    mediaFile.getFileName(),
                    userFilter.getKeepAudioLanguages(),
                    userFilter.getKeepSubtitleLanguages());
            return userFilter.toBuilder()
                    .allAudioTracks(langs.allAudioTracks())
                    .allSubTracks(langs.allSubTracks())
                    .audioTracksByLang(langs.audioByLang())
                    .subTracksByLang(langs.subByLang())
                    .videoTrack(langs.videoTrack())
                    .build();
        }

        // Build lists using the ORIGINAL codes from the file (not normalized) so
        // FFmpeg -map language specifiers match the container metadata exactly.
        List<String> keepAudio = buildCodeList(langs.audio());
        List<String> keepSubs  = buildCodeList(langs.subtitles());

        int totalAudio = langs.allAudioTracks() != null ? langs.allAudioTracks().size() : 0;
        int totalSubs  = langs.allSubTracks() != null ? langs.allSubTracks().size() : 0;

        if (keepAudio.isEmpty() && keepSubs.isEmpty()) {
            log.info("Smart filter: no priority languages in {} — keeping all {} audio + {} subtitle tracks",
                    mediaFile.getFileName(), totalAudio, totalSubs);
            return TrackFilter.builder()
                    .allAudioTracks(langs.allAudioTracks())
                    .allSubTracks(langs.allSubTracks())
                    .audioTracksByLang(langs.audioByLang())
                    .subTracksByLang(langs.subByLang())
                    .videoTrack(langs.videoTrack())
                    .build();
        }

        log.info("Smart filter for {}: kept audio={} (of {} total), kept subs={} (of {} total)",
                mediaFile.getFileName(), keepAudio, totalAudio, keepSubs, totalSubs);

        return TrackFilter.builder()
                .keepAudioLanguages(keepAudio.isEmpty() ? null : keepAudio)
                .keepSubtitleLanguages(keepSubs.isEmpty() ? null : keepSubs)
                .defaultAudioLanguage(keepAudio.isEmpty() ? null : keepAudio.getFirst())
                .noDefaultSubtitle(true)
                .audioStreamCounts(keepAudio.isEmpty() ? null : buildCountMap(keepAudio, langs.audioCounts()))
                .subStreamCounts(keepSubs.isEmpty() ? null : buildCountMap(keepSubs, langs.subCounts()))
                .allAudioTracks(langs.allAudioTracks())
                .allSubTracks(langs.allSubTracks())
                .audioTracksByLang(langs.audioByLang())
                .subTracksByLang(langs.subByLang())
                .videoTrack(langs.videoTrack())
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
        Map<String, String>  audioLangs   = new LinkedHashMap<>();
        Map<String, String>  subLangs     = new LinkedHashMap<>();
        Map<String, Integer> audioCounts  = new LinkedHashMap<>();
        Map<String, Integer> subCounts    = new LinkedHashMap<>();
        List<TrackFilter.TrackInfo> allAudio  = new ArrayList<>();
        List<TrackFilter.TrackInfo> allSubs   = new ArrayList<>();
        Map<String, List<TrackFilter.TrackInfo>> audioByLang = new LinkedHashMap<>();
        Map<String, List<TrackFilter.TrackInfo>> subByLang   = new LinkedHashMap<>();
        TrackFilter.VideoInfo videoTrack = null;
        try {
            String json = processExecutor.runFfprobeStreamsJson(file);
            JsonNode root    = objectMapper.readTree(json);
            JsonNode streams = root.path("streams");
            for (JsonNode stream : streams) {
                String  codecType   = stream.path("codec_type").asText("").trim();
                String  lang        = stream.path("tags").path("language").asText("").trim();
                String  codecName   = stream.path("codec_name").asText("").trim();
                long    bitRate     = parseBitRate(stream.path("bit_rate").asText(""));
                int     channels    = stream.path("channels").asInt(0);
                String  chanLayout  = stream.path("channel_layout").asText("").trim();
                boolean forced      = stream.path("disposition").path("forced").asInt(0) == 1;
                boolean defTrack    = stream.path("disposition").path("default").asInt(0) == 1;

                if ("video".equalsIgnoreCase(codecType)) {
                    // Skip cover-art / attached-picture "video" streams; keep only the first real video.
                    boolean attachedPic = stream.path("disposition").path("attached_pic").asInt(0) == 1;
                    if (!attachedPic && videoTrack == null) {
                        videoTrack = parseVideoInfo(stream, codecName, bitRate);
                    }
                } else if ("audio".equalsIgnoreCase(codecType)) {
                    if (!lang.isBlank()) {
                        String resolved = MediaTagResolver.resolveLanguage(lang.toLowerCase());
                        if (!"Unknown".equalsIgnoreCase(resolved)) {
                            audioLangs.putIfAbsent(resolved, lang);
                            audioCounts.merge(lang, 1, Integer::sum);
                        }
                    }
                    TrackFilter.TrackInfo info = new TrackFilter.TrackInfo(lang, codecName, bitRate, channels, chanLayout, forced, defTrack);
                    allAudio.add(info);
                    audioByLang.computeIfAbsent(lang, k -> new ArrayList<>()).add(info);
                } else if ("subtitle".equalsIgnoreCase(codecType)) {
                    if (!lang.isBlank()) {
                        String resolved = MediaTagResolver.resolveLanguage(lang.toLowerCase());
                        if (!"Unknown".equalsIgnoreCase(resolved)) {
                            subLangs.putIfAbsent(resolved, lang);
                            subCounts.merge(lang, 1, Integer::sum);
                        }
                    }
                    TrackFilter.TrackInfo info = new TrackFilter.TrackInfo(lang, codecName, bitRate, 0, "", forced, defTrack);
                    allSubs.add(info);
                    subByLang.computeIfAbsent(lang, k -> new ArrayList<>()).add(info);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to probe track languages for {}: {}", file.getFileName(), e.getMessage(), e);
        }
        return new TrackLanguages(audioLangs, subLangs, audioCounts, subCounts, allAudio, allSubs, audioByLang, subByLang, videoTrack);
    }

    /** Extracts the title-relevant properties of a real video stream. */
    private TrackFilter.VideoInfo parseVideoInfo(JsonNode stream, String codecName, long bitRate) {
        int    width         = stream.path("width").asInt(0);
        int    height        = stream.path("height").asInt(0);
        String colorTransfer = stream.path("color_transfer").asText("").trim();
        int    bitDepth      = parseBitDepth(stream);
        boolean dolbyVision  = hasDolbyVision(stream);
        return new TrackFilter.VideoInfo(codecName, width, height, bitRate, bitDepth, colorTransfer, dolbyVision);
    }

    /** Bit depth from bits_per_raw_sample, falling back to the pixel format (e.g. yuv420p10le → 10). */
    private int parseBitDepth(JsonNode stream) {
        int bprs = parseIntSafe(stream.path("bits_per_raw_sample").asText(""));
        if (bprs > 0) return bprs;
        String pixFmt = stream.path("pix_fmt").asText("");
        if (pixFmt.contains("p10")) return 10;
        if (pixFmt.contains("p12")) return 12;
        if (!pixFmt.isBlank())      return 8;
        return 0;
    }

    /** True when the video stream carries a Dolby Vision (DOVI) configuration record in its side data. */
    private boolean hasDolbyVision(JsonNode stream) {
        for (JsonNode sd : stream.path("side_data_list")) {
            String type = sd.path("side_data_type").asText("");
            if (type.toLowerCase().contains("dovi") || type.toLowerCase().contains("dolby vision")) {
                return true;
            }
        }
        return false;
    }

    private static int parseIntSafe(String s) {
        if (s == null || s.isBlank()) return 0;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return 0; }
    }

    private static long parseBitRate(String s) {
        if (s == null || s.isBlank()) return 0L;
        try { return Long.parseLong(s.trim()); } catch (NumberFormatException e) { return 0L; }
    }

    private record TrackLanguages(
            Map<String, String>  audio,
            Map<String, String>  subtitles,
            Map<String, Integer> audioCounts,
            Map<String, Integer> subCounts,
            List<TrackFilter.TrackInfo> allAudioTracks,
            List<TrackFilter.TrackInfo> allSubTracks,
            Map<String, List<TrackFilter.TrackInfo>> audioByLang,
            Map<String, List<TrackFilter.TrackInfo>> subByLang,
            TrackFilter.VideoInfo videoTrack
    ) {}
}
