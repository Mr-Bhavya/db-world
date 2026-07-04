package com.db.dbworld.audit.tracking.admin;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.tracking.admin.dto.ActivityOverviewDto;
import com.db.dbworld.audit.tracking.admin.dto.ClientBreakdownDto;
import com.db.dbworld.audit.tracking.admin.dto.LiveSessionDto;
import com.db.dbworld.audit.tracking.admin.dto.SessionEventDto;
import com.db.dbworld.audit.tracking.admin.dto.SessionRowDto;
import com.db.dbworld.audit.tracking.admin.dto.TopContentDto;
import com.db.dbworld.audit.tracking.admin.dto.TopUserDto;
import com.db.dbworld.audit.tracking.admin.dto.TrendDto;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.enums.SessionState;
import com.db.dbworld.audit.tracking.enums.TrackChannel;
import com.db.dbworld.audit.tracking.search.SearchHistoryService;
import com.db.dbworld.audit.tracking.search.dto.SearchKeywordDto;
import com.db.dbworld.core.role.annotations.AdminAccess;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

/**
 * Thin read-only REST facade over {@link AdminActivityService} for the admin
 * Activity console. No business logic lives here — every endpoint just wires
 * request params to the service and wraps the result in {@link ApiResponse}.
 */
@RestController
@RequestMapping("/api/admin/activity")
@RequiredArgsConstructor
public class AdminActivityController {

    private final AdminActivityService activityService;
    private final SearchHistoryService searchHistoryService;

    @AdminAccess
    @GetMapping("/overview")
    public ApiResponse<ActivityOverviewDto> getOverview(
            @RequestParam(defaultValue = "7") int days
    ) {
        return ApiResponse.success(activityService.getOverview(days));
    }

    @AdminAccess
    @GetMapping("/live")
    public ApiResponse<List<LiveSessionDto>> getLiveSessions(
            @RequestParam(defaultValue = "30") int withinMinutes
    ) {
        return ApiResponse.success(activityService.getLiveSessions(withinMinutes));
    }

    @AdminAccess
    @GetMapping("/sessions")
    public ApiResponse<Page<SessionRowDto>> searchSessions(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) ActivityKind activity,
            @RequestParam(required = false) TrackChannel channel,
            @RequestParam(required = false) String clientApp,
            @RequestParam(required = false) SessionState state,
            @RequestParam(required = false) Long recordId,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            Pageable pageable
    ) {
        return ApiResponse.success(activityService.searchSessions(
                userId, activity, channel, clientApp, state, recordId, from, to, pageable));
    }

    @AdminAccess
    @GetMapping("/sessions/{sessionId}/events")
    public ApiResponse<List<SessionEventDto>> getSessionEvents(
            @PathVariable String sessionId
    ) {
        return ApiResponse.success(activityService.getSessionEvents(sessionId));
    }

    @AdminAccess
    @GetMapping("/trend")
    public ApiResponse<List<TrendDto>> getTrend(
            @RequestParam(defaultValue = "30") int days
    ) {
        return ApiResponse.success(activityService.getTrend(days));
    }

    @AdminAccess
    @GetMapping("/client-breakdown")
    public ApiResponse<List<ClientBreakdownDto>> getClientBreakdown(
            @RequestParam(defaultValue = "30") int days
    ) {
        return ApiResponse.success(activityService.getClientBreakdown(days));
    }

    @AdminAccess
    @GetMapping("/top-content")
    public ApiResponse<List<TopContentDto>> getTopContent(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(activityService.getTopContent(days, limit));
    }

    @AdminAccess
    @GetMapping("/top-users")
    public ApiResponse<List<TopUserDto>> getTopUsers(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(activityService.getTopUsers(days, limit));
    }

    /**
     * Top search keywords over a trailing window, with zero-result counts. Delegates
     * to {@link SearchHistoryService} directly (rather than routing through
     * {@link AdminActivityService}) — search history is a distinct read model from
     * the session-based activity aggregates this controller otherwise fronts.
     */
    @AdminAccess
    @GetMapping("/search-keywords")
    public ApiResponse<List<SearchKeywordDto>> searchKeywords(
            @RequestParam(defaultValue = "30") int days,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ApiResponse.success(searchHistoryService.topKeywords(days, limit));
    }
}
