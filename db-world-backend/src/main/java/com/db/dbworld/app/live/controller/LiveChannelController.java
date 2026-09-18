package com.db.dbworld.app.live.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelDto;
import com.db.dbworld.app.live.dto.LiveDtos.ChannelSummaryDto;
import com.db.dbworld.app.live.service.LiveChannelService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public live-TV surface.
 *
 * <p>Reads only, and deliberately unauthenticated — the channel list is a handful of KB of
 * metadata, and the video itself never passes through this server: the player opens the
 * third-party CDN URL directly. That is why live TV costs essentially no bandwidth here,
 * unlike the media library. These paths are registered in
 * {@code AppConstants.PUBLIC_GET_APIS}.
 */
@RestController
@RequestMapping("/api/live")
@RequiredArgsConstructor
public class LiveChannelController {

    private final LiveChannelService service;

    /** Every visible channel as a grid tile — no stream URLs; see {@link #channel}. */
    @GetMapping("/channels")
    public ApiResponse<List<ChannelSummaryDto>> channels() {
        return ApiResponse.success(service.publicChannels());
    }

    /** Distinct group-titles, for the filter chips. */
    @GetMapping("/groups")
    public ApiResponse<List<String>> groups() {
        return ApiResponse.success(service.publicGroups());
    }

    /** One channel — what the player loads on a refresh or a shared link. */
    @GetMapping("/channels/{id}")
    public ApiResponse<ChannelDto> channel(@PathVariable String id) {
        return ApiResponse.success(service.publicChannel(id));
    }
}
