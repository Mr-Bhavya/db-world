package com.db.dbworld.app.home.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.home.dto.HomeSummaryDto;
import com.db.dbworld.app.home.service.HomeSummaryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The home dashboard's single data source.
 *
 * <p>Public on purpose — the hub is the site's landing page and is reachable signed out, so this
 * has to answer without a token. It is <em>not</em> anonymous-only: when a token is present the
 * response gains the user-scoped sections, which is why the service asks
 * {@code UserContext.optionalUser()} rather than requiring a principal.
 */
@RestController
@RequestMapping("/api/home")
@RequiredArgsConstructor
public class HomeSummaryController {

    private final HomeSummaryService service;

    /** GET /api/home/summary — one payload for every widget on the hub. */
    @GetMapping("/summary")
    public ApiResponse<HomeSummaryDto> summary() {
        return ApiResponse.success(service.summary());
    }
}
