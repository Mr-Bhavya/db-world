package com.db.dbworld.audit.tracking.me;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.tracking.enums.ActivityKind;
import com.db.dbworld.audit.tracking.me.dto.MeActivitySummaryDto;
import com.db.dbworld.audit.tracking.me.dto.MeSessionDto;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Thin read-only REST facade over {@link MeActivityService} for the personal
 * {@code /me/activity} page. Authenticated (non-admin) — every endpoint scopes
 * to {@link UserContext#userId()}, so a caller only ever sees their own data.
 *
 * <p>New path ({@code /api/me/tracking/*}) so it can coexist with the OLD
 * {@code /api/me/activity} controller ({@code com.db.dbworld.app.cinema.me.activity})
 * during the tracking-tables cutover; the old controller is left untouched here
 * and will be removed separately once the frontend switches over.
 */
@RestController
@RequestMapping("/api/me/tracking")
@RequiredArgsConstructor
public class MeActivityController {

    private final MeActivityService activityService;
    private final UserContext userContext;

    @GetMapping("/summary")
    public ApiResponse<MeActivitySummaryDto> getSummary() {
        return ApiResponse.success(activityService.getSummary(userContext.userId()));
    }

    @GetMapping("/timeline")
    public ApiResponse<Page<MeSessionDto>> getTimeline(
            @RequestParam(required = false) ActivityKind activity,
            Pageable pageable
    ) {
        return ApiResponse.success(activityService.getTimeline(userContext.userId(), activity, pageable));
    }
}
