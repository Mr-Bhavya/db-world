package com.db.dbworld.app.cinema.bootstrap.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.bootstrap.service.CatalogBootstrapService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cinema/admin/bootstrap")
@RequiredArgsConstructor
public class BootstrapController {

    private final CatalogBootstrapService bootstrapService;

    /**
     * Seeds any missing default rails. SAFE to re-run: existing rails are left exactly as they are,
     * so an admin's sort/priority/limit edits are never overwritten. Previously this rewrote the
     * sort and tag on every rail it recognised, which quietly undid UI changes.
     */
    @GetMapping
    public ApiResponse<String> bootstrap() {
        String summary = bootstrapService.bootstrap();
        return ApiResponse.success(summary, summary);
    }
}
