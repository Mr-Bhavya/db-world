package com.db.dbworld.app.media.ingestion.model;

import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.stream.tag.MediaTagResolver;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The audio/subtitle tracks detected in a downloaded file, broadcast to the admin when a job
 * enters {@code AWAITING_INPUT}, together with a pre-computed smart-default selection and the
 * deadline after which that default is auto-applied.
 *
 * <p>Selection is <b>language-based</b> (not per-index) so a single choice generalises across every
 * episode of a season pack — the exact model {@link TrackFilter} applies during the FFmpeg pass.
 */
public record TrackReviewOptions(
        String jobId,
        List<TrackOption> audio,
        List<TrackOption> subtitles,
        VideoSummary video,
        Selection smartDefault,
        long deadlineEpochMs
) {

    /** One detected track, flattened for display. */
    public record TrackOption(
            int index,          // position within its type (1-based), for display only
            String lang,        // raw code from the container, e.g. "hin" ("" when untagged)
            String langLabel,   // resolved full name, e.g. "Hindi" / "Undetermined"
            String codec,
            int channels,
            String channelLayout,
            long bitRate,
            boolean forced,
            boolean defaultTrack
    ) {}

    /** Primary video stream summary, shown for context. */
    public record VideoSummary(String codec, int width, int height, int bitDepth,
                               String colorTransfer, boolean dolbyVision) {}

    /** The pre-ticked suggestion the dialog opens with. */
    public record Selection(
            List<String> keepAudioLanguages,
            List<String> keepSubtitleLanguages,
            String defaultAudioLanguage,
            boolean removeAllSubtitles,
            boolean noDefaultSubtitle
    ) {}

    /**
     * Build the options payload from a {@link TrackFilter} already resolved by
     * {@code SmartTrackFilterService} (which carries both the detected tracks and the smart default).
     */
    public static TrackReviewOptions from(String jobId, TrackFilter resolved, long deadlineEpochMs) {
        List<TrackOption> audio = mapTracks(resolved.getAllAudioTracks());
        List<TrackOption> subs  = mapTracks(resolved.getAllSubTracks());

        // Pre-selection: keepXxxLanguages == null means "keep all" → pre-tick every detected language.
        List<String> keepAudio = resolved.getKeepAudioLanguages() != null
                ? resolved.getKeepAudioLanguages()
                : distinctLangs(audio);
        List<String> keepSubs = resolved.getKeepSubtitleLanguages() != null
                ? resolved.getKeepSubtitleLanguages()        // may be empty = drop all
                : distinctLangs(subs);

        Selection smart = new Selection(
                keepAudio,
                keepSubs,
                resolved.getDefaultAudioLanguage(),
                resolved.isRemoveAllSubtitles(),
                resolved.isNoDefaultSubtitle());

        VideoSummary video = null;
        TrackFilter.VideoInfo v = resolved.getVideoTrack();
        if (v != null) {
            video = new VideoSummary(v.codec(), v.width(), v.height(), v.bitDepth(),
                    v.colorTransfer(), v.dolbyVision());
        }

        return new TrackReviewOptions(jobId, audio, subs, video, smart, deadlineEpochMs);
    }

    private static List<TrackOption> mapTracks(List<TrackFilter.TrackInfo> tracks) {
        List<TrackOption> out = new ArrayList<>();
        if (tracks == null) return out;
        int i = 1;
        for (TrackFilter.TrackInfo t : tracks) {
            out.add(new TrackOption(
                    i++,
                    t.lang(),
                    label(t.lang()),
                    t.codec(),
                    t.channels(),
                    t.channelLayout(),
                    t.bitRate(),
                    t.forced(),
                    t.defaultTrack()));
        }
        return out;
    }

    private static String label(String lang) {
        if (lang == null || lang.isBlank()) return "Undetermined";
        String resolved = MediaTagResolver.resolveLanguage(lang.toLowerCase());
        return (resolved == null || "Unknown".equalsIgnoreCase(resolved)) ? lang : resolved;
    }

    private static List<String> distinctLangs(List<TrackOption> tracks) {
        Set<String> langs = new LinkedHashSet<>();
        for (TrackOption t : tracks) langs.add(t.lang());
        return new ArrayList<>(langs);
    }
}
