package com.db.dbworld.app.cinema.me.activity.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.me.activity.dto.MyActivitySummaryDto;
import com.db.dbworld.app.cinema.me.activity.dto.TopRewatchDto;
import com.db.dbworld.app.cinema.me.activity.service.MyActivityService;
import com.db.dbworld.audit.activity.dto.UserActivityViewDto;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/me/activity")
@RequiredArgsConstructor
public class MyActivityController {

    private final MyActivityService myActivityService;
    private final UserContext       userContext;

    /** Header stats: total stream hours, total download GB, completion rate, top genres. */
    @GetMapping("/summary")
    public ApiResponse<MyActivitySummaryDto> getSummary() {
        return ApiResponse.success(myActivityService.getSummary(userContext.userId()));
    }

    /** Top records this user has rewatched. */
    @GetMapping("/top-rewatches")
    public ApiResponse<List<TopRewatchDto>> getTopRewatches(
            @RequestParam(defaultValue = "6") int limit
    ) {
        return ApiResponse.success(myActivityService.getTopRewatches(userContext.userId(), limit));
    }

    /** Paginated activity timeline, optionally filtered by type. */
    @GetMapping
    public ApiResponse<List<UserActivityViewDto>> getActivities(
            @RequestParam(required = false) String type,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ApiResponse.success(
                myActivityService.getActivities(userContext.userId(), type, page, size));
    }
}
