package com.db.dbworld.audit.tracking.search;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.audit.tracking.search.dto.RecordSearchRequest;
import com.db.dbworld.core.context.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Per-user search-history endpoints backing the search bar's "recent searches"
 * dropdown. Authenticated but not admin-gated — every user manages only their
 * own history, resolved from the JWT via {@link UserContext}.
 */
@RestController
@RequestMapping("/api/me/search-history")
@RequiredArgsConstructor
public class MeSearchHistoryController {

    private final SearchHistoryService searchHistoryService;
    private final UserContext userContext;

    /** Records a search. Blank queries are a silent no-op — this must never 500 on a client quirk. */
    @PostMapping("")
    public ApiResponse<Void> record(
            @RequestBody RecordSearchRequest body,
            @RequestHeader(value = "X-DbWorld-Client", required = false) String client
    ) {
        String channel = "app".equalsIgnoreCase(client) ? "APP" : "WEB";
        searchHistoryService.record(
                userContext.userId(),
                body != null ? body.query() : null,
                body != null ? body.resultCount() : null,
                body != null ? body.openedRecordId() : null,
                channel
        );
        return ApiResponse.success(null);
    }

    @GetMapping
    public ApiResponse<List<String>> recent(@RequestParam(defaultValue = "8") int limit) {
        return ApiResponse.success(searchHistoryService.recent(userContext.userId(), limit));
    }

    /**
     * Clear-all vs. delete-one are disambiguated by presence of the {@code query}
     * request param (both map to the same {@code DELETE ""} path — a path-variable
     * form like {@code DELETE /{query}} breaks for queries containing '/').
     */
    @DeleteMapping(params = "query")
    public ApiResponse<Void> deleteOne(@RequestParam("query") String query) {
        searchHistoryService.clearOne(userContext.userId(), query);
        return ApiResponse.success(null);
    }

    @DeleteMapping
    public ApiResponse<Void> clearAll() {
        searchHistoryService.clearAll(userContext.userId());
        return ApiResponse.success(null);
    }
}
