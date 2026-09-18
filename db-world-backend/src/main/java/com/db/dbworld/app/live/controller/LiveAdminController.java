package com.db.dbworld.app.live.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelDto;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelPatch;
import com.db.dbworld.app.live.dto.LiveDtos.LiveStatsDto;
import com.db.dbworld.app.live.dto.LiveDtos.ManualChannelRequest;
import com.db.dbworld.app.live.dto.LiveDtos.PlaylistDto;
import com.db.dbworld.app.live.dto.LiveDtos.PlaylistRequest;
import com.db.dbworld.app.live.dto.LiveDtos.RefreshResult;
import com.db.dbworld.app.live.dto.LiveDtos.SourceRequest;
import com.db.dbworld.app.live.service.LiveChannelService;
import com.db.dbworld.app.live.service.LiveHealthService;
import com.db.dbworld.app.live.service.LiveIngestService;
import com.db.dbworld.config.AppConstants;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Live-TV administration: playlist sources, channels, and the stream URLs behind them. */
@RestController
@RequestMapping("/api/live/admin")
@RequiredArgsConstructor
@PreAuthorize(AppConstants.OWNER_ADMIN_AUTHORIZE)
public class LiveAdminController {

    private final LiveChannelService service;
    private final LiveIngestService  ingest;
    private final LiveHealthService  health;

    // ── Playlists ────────────────────────────────────────────────────────────────

    @GetMapping("/playlists")
    public ApiResponse<List<PlaylistDto>> listPlaylists() {
        return ApiResponse.success(service.listPlaylists());
    }

    /** Add a playlist URL. Import does not run here — call refresh, or wait for the job. */
    @PostMapping("/playlists")
    public ApiResponse<PlaylistDto> addPlaylist(@Valid @RequestBody PlaylistRequest request) {
        return ApiResponse.success(service.addPlaylist(request));
    }

    @PutMapping("/playlists/{id}")
    public ApiResponse<PlaylistDto> updatePlaylist(@PathVariable String id,
                                                   @RequestBody PlaylistRequest request) {
        return ApiResponse.success(service.updatePlaylist(id, request));
    }

    /** Remove a playlist, its stream URLs, and any channel left with nothing to play. */
    @DeleteMapping("/playlists/{id}")
    public ApiResponse<Void> deletePlaylist(@PathVariable String id) {
        service.deletePlaylist(id);
        return ApiResponse.success("Playlist removed");
    }

    /** Re-import one playlist now. */
    @PostMapping("/playlists/{id}/refresh")
    public ApiResponse<RefreshResult> refreshPlaylist(@PathVariable String id) {
        var result = ingest.refreshOne(id);
        ingest.pruneOrphanChannels();
        return ApiResponse.success(result);
    }

    /** Re-import every enabled playlist now. */
    @PostMapping("/refresh")
    public ApiResponse<RefreshResult> refreshAll() {
        return ApiResponse.success(ingest.refreshAll());
    }

    // ── Channels ─────────────────────────────────────────────────────────────────

    /** All channels including disabled and dead ones, with every source attached. */
    @GetMapping("/channels")
    public ApiResponse<List<ChannelDto>> channels(@RequestParam(required = false) String q) {
        return ApiResponse.success(service.adminChannels(q));
    }

    @PatchMapping("/channels/{id}")
    public ApiResponse<ChannelDto> patchChannel(@PathVariable String id,
                                                @Valid @RequestBody ChannelPatch patch) {
        return ApiResponse.success(service.patchChannel(id, patch));
    }

    @DeleteMapping("/channels/{id}")
    public ApiResponse<Void> deleteChannel(@PathVariable String id) {
        service.deleteChannel(id);
        return ApiResponse.success("Channel removed");
    }

    /** Create a channel from one stream URL, with no playlist involved. */
    @PostMapping("/channels")
    public ApiResponse<ChannelDto> addChannel(@Valid @RequestBody ManualChannelRequest request) {
        return ApiResponse.success(service.addManualChannel(request));
    }

    // ── Stream URLs ──────────────────────────────────────────────────────────────

    /** Add another URL to a channel; the player falls back to it when the first fails. */
    @PostMapping("/channels/{id}/sources")
    public ApiResponse<ChannelDto> addSource(@PathVariable String id,
                                             @Valid @RequestBody SourceRequest request) {
        return ApiResponse.success(service.addSource(id, request));
    }

    @DeleteMapping("/sources/{sourceId}")
    public ApiResponse<Void> deleteSource(@PathVariable String sourceId) {
        service.deleteSource(sourceId);
        return ApiResponse.success("Stream URL removed");
    }

    // ── Health ───────────────────────────────────────────────────────────────────

    /** Probe every source now. */
    @PostMapping("/health/check")
    public ApiResponse<LiveHealthService.HealthResult> checkAll() {
        return ApiResponse.success(health.probeAll());
    }

    /** Probe just this channel's sources — the per-row "test" button. */
    @PostMapping("/channels/{id}/health/check")
    public ApiResponse<LiveHealthService.HealthResult> checkChannel(@PathVariable String id) {
        return ApiResponse.success(health.probeChannel(id));
    }

    @GetMapping("/stats")
    public ApiResponse<LiveStatsDto> stats() {
        return ApiResponse.success(service.stats());
    }
}
