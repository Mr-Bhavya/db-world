package com.db.dbworld.app.live.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** Wire shapes for the live-TV module. Grouped in one file — they are small and read together. */
public final class LiveDtos {

    private LiveDtos() {}

    /** An M3U source as the admin console shows it. */
    public record PlaylistDto(
            String id,
            String name,
            String url,
            boolean enabled,
            String userAgent,
            String referer,
            int priority,
            Instant lastFetchedAt,
            String lastStatus,
            String lastError,
            int channelCount,
            /** Distinct stream URLs this playlist currently contributes. */
            long sourceCount
    ) {}

    /** Add or edit a playlist. Only {@code url} is required. */
    public record PlaylistRequest(
            @NotBlank @Size(max = 2048) String url,
            @Size(max = 120)  String name,
            @Size(max = 400)  String userAgent,
            @Size(max = 400)  String referer,
            Integer priority,
            Boolean enabled
    ) {}

    /** One playable URL behind a channel. */
    public record SourceDto(
            String id,
            String url,
            /** Resolution this URL serves, e.g. "1080p". Null when the playlist did not say. */
            String quality,
            String playlistId,
            String playlistName,
            int priority,
            boolean enabled,
            String health,
            Instant lastCheckedAt,
            String lastError,
            int failCount,
            String userAgent,
            String referer
    ) {}

    /** Admin adds a stream URL to a channel by hand, or creates a channel from one. */
    public record SourceRequest(
            @NotBlank @Size(max = 2048) String url,
            @Size(max = 400) String userAgent,
            @Size(max = 400) String referer,
            Integer priority
    ) {}

    /** Create a channel from nothing but a URL — the "add a single stream" path. */
    public record ManualChannelRequest(
            @NotBlank @Size(max = 300)  String name,
            @NotBlank @Size(max = 2048) String url,
            @Size(max = 200)  String group,
            @Size(max = 2048) String logoUrl,
            @Size(max = 400)  String userAgent,
            @Size(max = 400)  String referer
    ) {}

    /**
     * Admin edits to a channel. Null fields are left alone; blank clears an override.
     * {@code group} may be a {@code ;}-joined list, the same as a playlist's own value.
     */
    public record ChannelPatch(
            @Size(max = 300)  String name,
            @Size(max = 200)  String group,
            @Size(max = 2048) String logoUrl,
            Boolean enabled,
            Integer sortOrder
    ) {}

    /**
     * A channel as the GRID consumes it — no stream URLs.
     *
     * <p>The full {@link ChannelDto} carries every source, which on a large import is
     * several MB of URLs the grid never reads: it only needs to draw a tile. The player
     * fetches the one channel it is about to play from {@code /api/live/channels/{id}}
     * and gets the sources there.
     */
    public record ChannelSummaryDto(
            String id,
            String name,
            List<String> categories,
            String logoUrl,
            String health,
            /** ISO code, for flags and stable filtering. */
            String country,
            /** "India" — what the filter list shows. */
            String countryName,
            /** "Sony", "Zee" — derived from the name, which groups better than the API's network. */
            String brand,
            List<String> languages,
            /** Distinct resolutions across this channel's sources, best first. */
            List<String> qualities
    ) {}

    /**
     * A channel as both the admin console and the player consume it.
     *
     * @param sources every playable URL, best first — the player walks this list on failure
     */
    public record ChannelDto(
            String id,
            String name,
            /**
             * Every category this channel belongs to. Many-valued because a playlist's
             * {@code group-title} is a {@code ;}-joined list, not a single label.
             */
            List<String> categories,
            String logoUrl,
            String tvgId,
            String health,
            boolean enabled,
            int sortOrder,
            String country,
            String countryName,
            String brand,
            /** iptv-org's owning network. Display only — the brand filter uses {@code brand}. */
            String network,
            List<String> languages,
            List<String> qualities,
            List<SourceDto> sources
    ) {}

    /** Counters for the admin header. */
    public record LiveStatsDto(
            long playlists,
            long channels,
            long channelsUp,
            long channelsDown,
            long channelsUnknown,
            long sources
    ) {}

    /** Outcome of one playlist refresh, surfaced by both the admin button and the job summary. */
    public record RefreshResult(
            int playlistsRefreshed,
            int playlistsFailed,
            int channelsCreated,
            int channelsUpdated,
            int sourcesCreated,
            int sourcesRemoved
    ) {}
}
