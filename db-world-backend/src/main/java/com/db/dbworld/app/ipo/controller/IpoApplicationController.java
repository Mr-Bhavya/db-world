package com.db.dbworld.app.ipo.controller;

import com.db.dbworld.app.ipo.dto.IpoApplicationDto;
import com.db.dbworld.app.ipo.dto.MyIpoDto;
import com.db.dbworld.app.ipo.dto.SaveApplicationRequest;
import com.db.dbworld.app.ipo.service.IpoApplicationService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Applicant-level "My IPOs": lets a logged-in user save/view/remove their own application
 * details (application no, DP client id, PAN last-4, self-recorded allotment result) for an IPO,
 * and list every IPO they've applied to. Every endpoint scopes to {@link UserContext#userId()} —
 * this is per-user and login-gated, NOT listed in {@code PUBLIC_APIS}.
 */
@RestController
@RequestMapping("/api/ipo")
@RequiredArgsConstructor
@AnyRole
public class IpoApplicationController {

    private final IpoApplicationService applicationService;
    private final UserContext userContext;

    @PostMapping("/{id}/application")
    public ApiResponse<IpoApplicationDto> save(@PathVariable String id, @RequestBody SaveApplicationRequest req) {
        return ApiResponse.success(applicationService.upsert(userContext.userId(), id, req));
    }

    /** {@code data} is {@code null} (not a 404) when the caller hasn't saved an application for this IPO. */
    @GetMapping("/{id}/application")
    public ApiResponse<IpoApplicationDto> mine(@PathVariable String id) {
        return ApiResponse.success(applicationService.getMine(userContext.userId(), id).orElse(null));
    }

    @GetMapping("/my/applications")
    public ApiResponse<List<MyIpoDto>> myApplications() {
        return ApiResponse.success(applicationService.listMine(userContext.userId()));
    }

    @DeleteMapping("/{id}/application")
    public ApiResponse<Void> delete(@PathVariable String id) {
        applicationService.delete(userContext.userId(), id);
        return ApiResponse.success("Removed");
    }
}
