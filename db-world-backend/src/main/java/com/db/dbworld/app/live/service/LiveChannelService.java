package com.db.dbworld.app.live.service;

import com.db.dbworld.app.live.dto.LiveDtos.ChannelDto;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelPatch;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelSummaryDto;
import com.db.dbworld.app.live.dto.LiveDtos.LiveStatsDto;
import com.db.dbworld.app.live.dto.LiveDtos.ManualChannelRequest;
import com.db.dbworld.app.live.dto.LiveDtos.PlaylistDto;
import com.db.dbworld.app.live.dto.LiveDtos.PlaylistRequest;
import com.db.dbworld.app.live.dto.LiveDtos.SourceDto;
import com.db.dbworld.app.live.dto.LiveDtos.SourceRequest;
import com.db.dbworld.app.live.entity.LiveChannelEntity;
import com.db.dbworld.app.live.entity.LiveChannelSourceEntity;
import com.db.dbworld.app.live.entity.LiveHealth;
import com.db.dbworld.app.live.entity.LivePlaylistEntity;
import com.db.dbworld.app.live.repository.LiveChannelRepository;
import com.db.dbworld.app.live.repository.LiveChannelSourceRepository;
import com.db.dbworld.app.live.repository.LivePlaylistRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ResourceNotFoundException;

import java.net.URI;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.CONFLICT;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/** Reads and edits for live channels, playlists and their stream URLs. */
@Log4j2
@Service
@RequiredArgsConstructor
public class LiveChannelService {

    private final LivePlaylistRepository      playlists;
    private final LiveChannelRepository       channels;
    private final LiveChannelSourceRepository sources;
    private final LiveIngestService           ingest;
    private final M3uParser                   parser;
    private final LiveWriteLock               writeLock;

    // ── Public reads ─────────────────────────────────────────────────────────────

    /**
     * Every channel a signed-out visitor may see, as grid tiles.
     *
     * <p>Deliberately WITHOUT stream URLs: on a large import those are megabytes the grid
     * never looks at. A channel whose every source is disabled or dead is still dropped
     * here, so nothing untappable reaches the page.
     */
    public List<ChannelSummaryDto> publicChannels() {
        return withSources(channels.findPublicChannels(), true).stream()
                .map(c -> new ChannelSummaryDto(
                        c.id(), c.name(), c.categories(), c.logoUrl(), c.health(),
                        c.country(), c.countryName(), c.brand(), c.languages(), c.qualities()))
                .toList();
    }

    public List<String> publicGroups() {
        return channels.findPublicGroups();
    }

    /**
     * One channel with its sources, for the player.
     *
     * @throws ResourceNotFoundException when the channel is missing or disabled
     */
    public ChannelDto publicChannel(String id) {
        var channel = channels.findById(id)
                .filter(LiveChannelEntity::isEnabled)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", id));
        return withSources(List.of(channel), true).stream().findFirst()
                .orElseThrow(() -> new DbWorldException(NOT_FOUND, "This channel has no working stream right now"));
    }

    // ── Admin: playlists ─────────────────────────────────────────────────────────

    public List<PlaylistDto> listPlaylists() {
        var all = playlists.findAllByOrderByPriorityAscNameAsc();
        return all.stream().map(p -> toDto(p, sources.countByPlaylistId(p.getId()))).toList();
    }

    /**
     * Add a playlist. The URL is the identity — adding the same one twice is a conflict
     * rather than a silent duplicate, because two rows for one URL would each import the
     * same sources and then fight over which owns them on refresh.
     */
    @Transactional
    public PlaylistDto addPlaylist(PlaylistRequest request) {
        var url = request.url().strip();
        if (playlists.existsByUrl(url)) {
            throw new DbWorldException(CONFLICT, "That playlist has already been added");
        }
        var saved = playlists.save(LivePlaylistEntity.builder()
                .url(url)
                .name(isBlank(request.name()) ? deriveName(url) : request.name().strip())
                .userAgent(blankToNull(request.userAgent()))
                .referer(blankToNull(request.referer()))
                .priority(request.priority() == null ? 100 : request.priority())
                .enabled(request.enabled() == null || request.enabled())
                .createdAt(Instant.now())
                .build());
        log.info("Live playlist added: {} ({})", saved.getName(), saved.getUrl());
        return toDto(saved, 0);
    }

    @Transactional
    public PlaylistDto updatePlaylist(String id, PlaylistRequest request) {
        var playlist = playlists.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist", "id", id));

        var url = request.url() == null ? playlist.getUrl() : request.url().strip();
        if (!url.equals(playlist.getUrl()) && playlists.existsByUrl(url)) {
            throw new DbWorldException(CONFLICT, "Another playlist already uses that URL");
        }
        playlist.setUrl(url);
        if (request.name() != null)       playlist.setName(isBlank(request.name()) ? deriveName(url) : request.name().strip());
        if (request.userAgent() != null)  playlist.setUserAgent(blankToNull(request.userAgent()));
        if (request.referer() != null)    playlist.setReferer(blankToNull(request.referer()));
        if (request.priority() != null)   playlist.setPriority(request.priority());
        if (request.enabled() != null)    playlist.setEnabled(request.enabled());
        playlists.save(playlist);
        return toDto(playlist, sources.countByPlaylistId(playlist.getId()));
    }

    /**
     * Remove a playlist and everything it contributed.
     *
     * <p>Its sources go with it; channels left with no source at all are pruned. A channel
     * that another playlist also carries keeps that playlist's source and survives, which
     * is the behaviour that makes overlapping playlists safe to remove.
     */
    @Transactional
    public void deletePlaylist(String id) {
        var playlist = playlists.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Playlist", "id", id));
        var removed = sources.deleteByPlaylistId(id);
        playlists.delete(playlist);
        var orphans = ingest.pruneOrphanChannels();
        log.info("Live playlist removed: {} — {} sources and {} orphaned channels deleted",
                playlist.getName(), removed, orphans);
    }

    // ── Admin: channels and their stream URLs ────────────────────────────────────

    public List<ChannelDto> adminChannels(String query) {
        return withSources(channels.search(blankToNull(query)), false);
    }

    @Transactional
    public ChannelDto patchChannel(String id, ChannelPatch patch) {
        var channel = channels.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", id));
        // A blank string clears the override and falls back to what the playlist said;
        // null leaves it untouched. Both have to be expressible or an admin could set a
        // custom name but never undo it.
        if (patch.name() != null)      channel.setCustomName(blankToNull(patch.name()));
        if (patch.group() != null) {
            channel.setCustomGroup(blankToNull(patch.group()));
            // Categories are derived, so an override only takes effect once re-split;
            // clearing it falls back to whatever the playlist said.
            channel.setCategories(new LinkedHashSet<>(parser.splitCategories(
                    isBlank(channel.getCustomGroup()) ? channel.getGroupTitle() : channel.getCustomGroup())));
        }
        if (patch.logoUrl() != null)   channel.setLogoUrl(blankToNull(patch.logoUrl()));
        if (patch.enabled() != null)   channel.setEnabled(patch.enabled());
        if (patch.sortOrder() != null) channel.setSortOrder(patch.sortOrder());
        channels.save(channel);
        return withSources(List.of(channel), false).getFirst();
    }

    @Transactional
    public void deleteChannel(String id) {
        var channel = channels.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", id));
        sources.deleteByChannelId(id);
        channels.delete(channel);
    }

    /** Add one more stream URL to an existing channel — the manual failover mirror. */
    @Transactional
    public ChannelDto addSource(String channelId, SourceRequest request) {
        var channel = channels.findById(channelId)
                .orElseThrow(() -> new ResourceNotFoundException("Channel", "id", channelId));
        var url  = requireHttpUrl(request.url());
        var hash = UrlHash.of(url);
        if (sources.findByChannelIdAndUrlHash(channelId, hash).isPresent()) {
            throw new DbWorldException(CONFLICT, "This channel already has that URL");
        }
        sources.save(LiveChannelSourceEntity.builder()
                .channelId(channelId)
                .playlistId(null)                       // hand-added; no refresh will remove it
                .url(url)
                .urlHash(hash)
                .userAgent(blankToNull(request.userAgent()))
                .referer(blankToNull(request.referer()))
                // Default ahead of imported sources: an admin typing a URL in by hand is
                // correcting the playlist, so their URL should be tried first.
                .priority(request.priority() == null ? 10 : request.priority())
                .createdAt(Instant.now())
                .build());
        return withSources(List.of(channel), false).getFirst();
    }

    @Transactional
    public void deleteSource(String sourceId) {
        var source = sources.findById(sourceId)
                .orElseThrow(() -> new ResourceNotFoundException("Stream URL", "id", sourceId));
        sources.delete(source);
        // Removing the last URL leaves a channel that cannot play; drop it with the URL.
        if (sources.findByChannelIdOrderByPriorityAscCreatedAtAsc(source.getChannelId()).isEmpty()) {
            channels.deleteById(source.getChannelId());
        }
    }

    /** Create a channel from a single stream URL, with no playlist involved. */
    @Transactional
    public ChannelDto addManualChannel(ManualChannelRequest request) {
        var url  = requireHttpUrl(request.url());
        var name = request.name().strip();
        var key  = parser.channelKey(null, name);

        var channel = channels.findByChannelKey(key).orElseGet(() -> channels.save(LiveChannelEntity.builder()
                .channelKey(key)
                .name(name)
                .groupTitle(blankToNull(request.group()))
                .categories(new LinkedHashSet<>(parser.splitCategories(request.group())))
                .logoUrl(blankToNull(request.logoUrl()))
                .lastSeenAt(Instant.now())
                .createdAt(Instant.now())
                .build()));

        var hash = UrlHash.of(url);
        if (sources.findByChannelIdAndUrlHash(channel.getId(), hash).isEmpty()) {
            sources.save(LiveChannelSourceEntity.builder()
                    .channelId(channel.getId())
                    .url(url)
                    .urlHash(hash)
                    .userAgent(blankToNull(request.userAgent()))
                    .referer(blankToNull(request.referer()))
                    .priority(10)
                    .createdAt(Instant.now())
                    .build());
        }
        return withSources(List.of(channel), false).getFirst();
    }

    public LiveStatsDto stats() {
        var busy = writeLock.current();
        return new LiveStatsDto(
                playlists.count(),
                channels.count(),
                channels.countByHealth(LiveHealth.UP),
                channels.countByHealth(LiveHealth.DOWN),
                channels.countByHealth(LiveHealth.UNKNOWN),
                sources.count(),
                sources.countByLastCheckedAtIsNotNull(),
                sources.findLastHealthCheckAt(),
                busy == null ? null : busy.what(),
                busy == null ? 0 : busy.seconds());
    }

    // ── Mapping ──────────────────────────────────────────────────────────────────

    /**
     * Attach each channel's sources in the order the player should try them.
     *
     * @param publicView drop disabled and known-dead sources, and drop a channel that ends
     *                   up with none — the admin view keeps them so they can be fixed
     */
    private List<ChannelDto> withSources(List<LiveChannelEntity> rows, boolean publicView) {
        if (rows.isEmpty()) return List.of();

        var ids       = rows.stream().map(LiveChannelEntity::getId).toList();
        var byChannel = sources.findByChannelIdIn(ids).stream()
                .collect(Collectors.groupingBy(LiveChannelSourceEntity::getChannelId));
        // Categories are a LAZY element collection: these entities are detached by the
        // time they reach here, so touching channel.getCategories() throws. Fetch every
        // pair in one query and join in memory, exactly as the sources above do.
        Map<String, List<String>> categoriesByChannel = channels.findCategoriesFor(ids).stream()
                .collect(Collectors.groupingBy(
                        LiveChannelRepository.CategoryRow::channelId,
                        Collectors.mapping(LiveChannelRepository.CategoryRow::category, Collectors.toList())));
        // Languages are a second lazy collection with exactly the same trap.
        Map<String, List<String>> languagesByChannel = channels.findLanguagesFor(ids).stream()
                .collect(Collectors.groupingBy(
                        LiveChannelRepository.LanguageRow::channelId,
                        Collectors.mapping(LiveChannelRepository.LanguageRow::language, Collectors.toList())));
        // Only the admin view needs to attribute a URL to the playlist it came from, and
        // this is an extra query, so skip it entirely for the public list.
        Map<String, String> playlistNames = publicView ? Map.of() : playlists.findAll().stream()
                .collect(Collectors.toMap(LivePlaylistEntity::getId, LivePlaylistEntity::getName));

        return rows.stream()
                .map(channel -> {
                    var mine = byChannel.getOrDefault(channel.getId(), List.of()).stream()
                            .filter(s -> !publicView || (s.isEnabled() && s.getHealth() != LiveHealth.DOWN))
                            .sorted(SOURCE_ORDER)
                            .map(s -> publicView ? toPublicDto(s) : toDto(s, playlistNames.get(s.getPlaylistId())))
                            .toList();
                    if (publicView && mine.isEmpty()) return null;
                    return new ChannelDto(
                            channel.getId(),
                            firstNonBlank(channel.getCustomName(), channel.getName()),
                            categoriesByChannel.getOrDefault(channel.getId(), List.of()),
                            channel.getLogoUrl(),
                            channel.getTvgId(),
                            channel.getHealth().name(),
                            channel.isEnabled(),
                            channel.getSortOrder(),
                            channel.getCountry(),
                            channel.getCountryName(),
                            channel.getBrand(),
                            channel.getNetwork(),
                            languagesByChannel.getOrDefault(channel.getId(), List.of()),
                            qualitiesOf(mine),
                            mine);
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    /**
     * The distinct resolutions a channel can be watched at, highest first.
     *
     * <p>Sorted numerically rather than alphabetically, or "720p" would outrank "1080p".
     */
    private static List<String> qualitiesOf(List<SourceDto> sources) {
        return sources.stream()
                .map(SourceDto::quality)
                .filter(q -> q != null && !q.isBlank())
                .distinct()
                .sorted(Comparator.comparingInt(LiveChannelService::qualityRank).reversed())
                .toList();
    }

    /** Leading digits of "1080p"; 0 for anything unparseable, so it sorts last. */
    private static int qualityRank(String quality) {
        var digits = quality.replaceAll("\\D+", "");
        try {
            return digits.isEmpty() ? 0 : Integer.parseInt(digits);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * Health first, then priority, then age. A source proven to work has to outrank an
     * untested one, or a channel whose first-listed mirror is dead would open on the dead
     * one every time and only reach the working mirror after a visible failure.
     */
    private static final Comparator<LiveChannelSourceEntity> SOURCE_ORDER =
            Comparator.comparingInt((LiveChannelSourceEntity s) -> switch (s.getHealth()) {
                        case UP -> 0;
                        case UNKNOWN -> 1;
                        case DOWN -> 2;
                    })
                    .thenComparingInt(LiveChannelSourceEntity::getPriority)
                    .thenComparing(LiveChannelSourceEntity::getCreatedAt,
                            Comparator.nullsLast(Comparator.naturalOrder()));

    /**
     * The source as an anonymous visitor may see it: the URL, and the two headers the
     * player has to forward for the CDN to serve it.
     *
     * <p>Everything else on a source is operational — which playlist supplied it, its
     * probe history, why it last failed — and the channel list is served without
     * authentication, so none of it belongs on the wire.
     */
    private static SourceDto toPublicDto(LiveChannelSourceEntity s) {
        return new SourceDto(s.getId(), s.getUrl(), s.getQuality(), null, null,
                s.getPriority(), true, s.getHealth().name(), null,
                null, 0, s.getUserAgent(), s.getReferer());
    }

    private static SourceDto toDto(LiveChannelSourceEntity s, String playlistName) {
        return new SourceDto(s.getId(), s.getUrl(), s.getQuality(), s.getPlaylistId(), playlistName,
                s.getPriority(), s.isEnabled(), s.getHealth().name(), s.getLastCheckedAt(),
                s.getLastError(), s.getFailCount(), s.getUserAgent(), s.getReferer());
    }

    private static PlaylistDto toDto(LivePlaylistEntity p, long sourceCount) {
        return new PlaylistDto(p.getId(), p.getName(), p.getUrl(), p.isEnabled(),
                p.getUserAgent(), p.getReferer(), p.getPriority(), p.getLastFetchedAt(),
                p.getLastStatus(), p.getLastError(), p.getChannelCount(), sourceCount);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────────

    private static String requireHttpUrl(String url) {
        var trimmed = String.valueOf(url).strip();
        var lower   = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new DbWorldException(BAD_REQUEST, "Stream URL must start with http:// or https://");
        }
        return trimmed;
    }

    /** "https://iptv-org.github.io/iptv/index.m3u" becomes "iptv-org.github.io". */
    private static String deriveName(String url) {
        try {
            var host = URI.create(url).getHost();
            return isBlank(host) ? "Playlist" : host;
        } catch (IllegalArgumentException e) {
            return "Playlist";
        }
    }

    private static boolean isBlank(String s) { return s == null || s.isBlank(); }

    private static String blankToNull(String s) { return isBlank(s) ? null : s.strip(); }

    private static String firstNonBlank(String a, String b) { return isBlank(a) ? b : a; }
}
