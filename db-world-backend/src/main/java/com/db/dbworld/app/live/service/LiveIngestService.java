package com.db.dbworld.app.live.service;

import com.db.dbworld.app.live.dto.LiveDtos.RefreshResult;
import com.db.dbworld.app.live.entity.LiveChannelEntity;
import com.db.dbworld.app.live.entity.LiveChannelSourceEntity;
import com.db.dbworld.app.live.entity.LivePlaylistEntity;
import com.db.dbworld.app.live.repository.LiveChannelRepository;
import com.db.dbworld.app.live.repository.LiveChannelSourceRepository;
import com.db.dbworld.app.live.repository.LivePlaylistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import com.db.dbworld.core.exception.DbWorldException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Turns playlists into channels.
 *
 * <p>The merge is the point of this class. Channels are keyed by
 * {@code channelKey} across every playlist, and each distinct URL for a key becomes a
 * separate source row. Import the same channel from three playlists and you get one
 * channel with three sources — which is what lets playback fail over instead of
 * presenting the viewer with three identical, individually unreliable tiles.
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class LiveIngestService {

    private final LivePlaylistRepository      playlists;
    private final LiveChannelRepository       channels;
    private final LiveChannelSourceRepository sources;
    private final PlaylistFetcher             fetcher;
    private final M3uParser                   parser;
    private final IptvOrgEnricher             enricher;

    /**
     * This bean, through its proxy.
     *
     * <p>Calling {@code refreshOne} directly from {@code refreshAll} would be a plain Java
     * call that never touches the proxy, so its {@code @Transactional} would silently do
     * nothing on the scheduled path while working on the controller path. Going through
     * the provider keeps one playlist's failure from taking another's work with it,
     * whoever started the run.
     */
    private final ObjectProvider<LiveIngestService> self;

    /**
     * Only one import may run at a time.
     *
     * <p>An import is thousands of inserts against {@code live_channel}, whose
     * {@code channel_key} is unique — so two concurrent runs (the 6-hourly job and an
     * admin pressing "Refresh all", or two impatient presses) block on the same index
     * rows until MySQL gives up with "Lock wait timeout exceeded". Refusing the second
     * run outright is both correct and more useful than making the caller wait: it has
     * nothing to add, since the run already in flight is importing the same playlists.
     */
    private final ReentrantLock importLock = new ReentrantLock();

    /**
     * A completed refresh, or the fact that one was declined because another was running.
     * Lets the scheduler distinguish the two without catching an exception at the call site.
     */
    public record RefreshResultOrSkip(RefreshResult result, boolean skipped) {
        public static RefreshResultOrSkip of(RefreshResult result) { return new RefreshResultOrSkip(result, false); }
        public static RefreshResultOrSkip skip()                   { return new RefreshResultOrSkip(null, true); }
    }

    /** Refresh every enabled playlist, accumulating one combined result. */
    public RefreshResult refreshAll() {
        if (!importLock.tryLock()) {
            log.info("Live playlist refresh skipped — an import is already running");
            throw new ImportInProgressException();
        }
        try {
            return refreshAllLocked();
        } finally {
            importLock.unlock();
        }
    }

    /**
     * Thrown when a refresh is requested while one is already running.
     *
     * <p>A {@link DbWorldException} so the admin endpoints answer 409 carrying this
     * message. {@code ResponseStatusException} would NOT work: {@code
     * GlobalExceptionHandler} has no handler for it, so it falls through to the catch-all
     * and the caller gets a 500 reading "Unexpected error occurred". The scheduler catches
     * this and records the run as skipped — declining to pile on is not a failure.
     */
    public static class ImportInProgressException extends DbWorldException {
        public ImportInProgressException() {
            super(HttpStatus.CONFLICT, "An import is already running — wait for it to finish");
        }
    }

    private RefreshResult refreshAllLocked() {
        // Once per run: the four API files are ~16 MB, so doing this per playlist would
        // dominate the import. Best-effort — a failure here leaves playlist-derived data.
        enricher.refreshIfStale();
        var enabled = playlists.findByEnabledTrueOrderByPriorityAscNameAsc();
        var total   = new RefreshResult(0, 0, 0, 0, 0, 0);
        for (var playlist : enabled) {
            var one = self.getObject().refreshOne(playlist.getId());
            total = new RefreshResult(
                    total.playlistsRefreshed() + one.playlistsRefreshed(),
                    total.playlistsFailed()    + one.playlistsFailed(),
                    total.channelsCreated()    + one.channelsCreated(),
                    total.channelsUpdated()    + one.channelsUpdated(),
                    total.sourcesCreated()     + one.sourcesCreated(),
                    total.sourcesRemoved()     + one.sourcesRemoved());
        }
        // Deleting a playlist's last source for a channel leaves the channel behind with
        // nothing to play. Sweep once at the end rather than per playlist, so a channel
        // that moves between two playlists in the same run is not deleted and recreated.
        self.getObject().pruneOrphanChannels();
        return total;
    }

    /**
     * Refresh one playlist.
     *
     * <p>Runs in its own transaction: a playlist whose host is down must not roll back the
     * channels a healthy playlist just contributed.
     */
    @Transactional
    public RefreshResult refreshOne(String playlistId) {
        // Held for the whole import, and reentrant so refreshAll's per-playlist calls
        // pass straight through on the thread that already owns it.
        if (!importLock.tryLock()) {
            log.info("Live playlist refresh skipped — an import is already running");
            throw new ImportInProgressException();
        }
        try {
            return refreshOneLocked(playlistId);
        } finally {
            importLock.unlock();
        }
    }

    private RefreshResult refreshOneLocked(String playlistId) {
        enricher.refreshIfStale();   // no-op when already loaded within its TTL
        var playlist = playlists.findById(playlistId).orElse(null);
        if (playlist == null) return new RefreshResult(0, 1, 0, 0, 0, 0);

        List<M3uParser.ParsedChannel> parsed;
        try {
            var text = fetcher.fetch(playlist.getUrl(), playlist.getUserAgent());
            parsed   = parser.parse(text);
            if (parsed.isEmpty()) throw new PlaylistFetcher.FetchException("No channels found — is this an M3U file?");
        } catch (RuntimeException e) {
            log.warn("Live playlist '{}' refresh failed: {}", playlist.getName(), e.getMessage());
            playlist.setLastFetchedAt(Instant.now());
            playlist.setLastStatus("ERROR");
            playlist.setLastError(truncate(e.getMessage(), 500));
            playlists.save(playlist);
            return new RefreshResult(0, 1, 0, 0, 0, 0);
        }

        var now = Instant.now();
        var created = 0;
        var updated = 0;
        var added   = 0;

        // Load every channel this playlist mentions in one query — a 10k-channel playlist
        // would otherwise issue 10k selects.
        var keys     = parsed.stream().map(M3uParser.ParsedChannel::channelKey).collect(java.util.stream.Collectors.toSet());
        Map<String, LiveChannelEntity> byKey = new HashMap<>();
        for (var c : channels.findByChannelKeyIn(keys)) byKey.put(c.getChannelKey(), c);

        Set<String> seenSourceHashes = new HashSet<>();

        for (var row : parsed) {
            var channel = byKey.get(row.channelKey());
            if (channel == null) {
                channel = channels.save(LiveChannelEntity.builder()
                        .channelKey(row.channelKey())
                        .name(row.name())
                        .tvgId(row.tvgId())
                        .logoUrl(row.logoUrl())
                        .groupTitle(row.groupTitle())
                        .categories(new LinkedHashSet<>(row.categories()))
                        .brand(row.brand())
                        .lastSeenAt(now)
                        .createdAt(now)
                        .build());
                applyEnrichment(channel, row);
                byKey.put(row.channelKey(), channel);
                created++;
            } else {
                // Refresh only the fields the playlist owns. Admin overrides (customName,
                // customGroup, enabled, sortOrder) are never touched by an import — an
                // admin's edit surviving the next refresh is the whole point of keeping
                // them in separate columns.
                var changed = false;
                if (isBlank(channel.getLogoUrl())    && row.logoUrl() != null)    { channel.setLogoUrl(row.logoUrl());       changed = true; }
                if (isBlank(channel.getGroupTitle()) && row.groupTitle() != null) { channel.setGroupTitle(row.groupTitle()); changed = true; }
                if (isBlank(channel.getTvgId())      && row.tvgId() != null)      { channel.setTvgId(row.tvgId());           changed = true; }
                // Categories are DERIVED, so unlike the fields above they are re-computed on
                // every refresh rather than only filled in when missing. That is what lets a
                // fix to the splitting rules reach channels imported before it.
                var derived = deriveCategories(channel);
                if (!derived.equals(channel.getCategories())) { channel.setCategories(derived); changed = true; }
                if (!java.util.Objects.equals(channel.getBrand(), row.brand())) { channel.setBrand(row.brand()); changed = true; }
                applyEnrichment(channel, row);
                channel.setLastSeenAt(now);
                channels.save(channel);
                if (changed) updated++;
            }

            var hash = UrlHash.of(row.url());
            seenSourceHashes.add(hash);
            var existing = sources.findByChannelIdAndUrlHash(channel.getId(), hash).orElse(null);
            if (existing == null) {
                sources.save(LiveChannelSourceEntity.builder()
                        .channelId(channel.getId())
                        .playlistId(playlist.getId())
                        .url(row.url())
                        .urlHash(hash)
                        .quality(row.quality())
                        .userAgent(row.userAgent())
                        .referer(row.referer())
                        .priority(playlist.getPriority())
                        .createdAt(now)
                        .build());
                added++;
            } else {
                // The same URL can arrive from a second playlist. Keep the first owner, but
                // take any headers the newer copy carries and the older one lacked.
                var touched = false;
                if (existing.getQuality()   == null && row.quality()   != null) { existing.setQuality(row.quality());     touched = true; }
                if (existing.getUserAgent() == null && row.userAgent() != null) { existing.setUserAgent(row.userAgent()); touched = true; }
                if (existing.getReferer()   == null && row.referer()   != null) { existing.setReferer(row.referer());     touched = true; }
                if (touched) sources.save(existing);
            }
        }

        // Sources this playlist contributed on a previous run and no longer lists. Manual
        // sources (playlistId == null) and other playlists' sources are left alone.
        var stale = sources.findByPlaylistId(playlist.getId()).stream()
                .filter(s -> !seenSourceHashes.contains(s.getUrlHash()))
                .toList();
        if (!stale.isEmpty()) sources.deleteAll(stale);

        playlist.setLastFetchedAt(now);
        playlist.setLastStatus("OK");
        playlist.setLastError(null);
        playlist.setChannelCount(parsed.size());
        playlists.save(playlist);

        log.info("Live playlist '{}' refreshed — {} entries, {} new channels, {} new sources, {} stale removed",
                playlist.getName(), parsed.size(), created, added, stale.size());

        return new RefreshResult(1, 0, created, updated, added, stale.size());
    }

    /** Drop channels that have no sources left — nothing to play, nothing to show. */
    @Transactional
    public int pruneOrphanChannels() {
        var orphans = channels.findOrphans();
        if (orphans.isEmpty()) return 0;
        channels.deleteAll(orphans);
        log.info("Pruned {} live channels with no remaining sources", orphans.size());
        return orphans.size();
    }

    /**
     * Overlay iptv-org's metadata on a channel, falling back to what the playlist implied.
     *
     * <p>Country prefers the API and falls back to the tvg-id suffix, so a channel the API
     * has never heard of still gets filed under a country. Categories are only ADDED to,
     * never replaced: the playlist's own grouping is what the admin sees and overrides.
     */
    private void applyEnrichment(LiveChannelEntity channel, M3uParser.ParsedChannel row) {
        var found = enricher.forTvgId(row.tvgId());

        var country     = found.map(IptvOrgEnricher.Enrichment::country).orElse(row.country());
        var countryName = found.map(IptvOrgEnricher.Enrichment::countryName).orElse(null);
        channel.setCountry(country);
        channel.setCountryName(countryName != null ? countryName : country);

        found.map(IptvOrgEnricher.Enrichment::network).ifPresent(channel::setNetwork);

        var languages = found.map(IptvOrgEnricher.Enrichment::languages).orElse(List.of());
        if (!languages.isEmpty()) channel.setLanguages(new LinkedHashSet<>(languages));

        // A channel the playlist left uncategorised still gets the API's categories.
        var apiCategories = found.map(IptvOrgEnricher.Enrichment::categories).orElse(List.of());
        if (!apiCategories.isEmpty() && channel.getCategories().isEmpty()) {
            channel.setCategories(new LinkedHashSet<>(apiCategories));
        }
    }

    /**
     * The categories a channel should have, from its admin override when set and the
     * playlist's raw {@code group-title} otherwise.
     */
    private Set<String> deriveCategories(LiveChannelEntity channel) {
        var raw = isBlank(channel.getCustomGroup()) ? channel.getGroupTitle() : channel.getCustomGroup();
        return new LinkedHashSet<>(parser.splitCategories(raw));
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }

    /** Ordered list of playlist entities needing a refresh, exposed for the scheduler. */
    public List<LivePlaylistEntity> enabledPlaylists() {
        return new ArrayList<>(playlists.findByEnabledTrueOrderByPriorityAscNameAsc());
    }
}
