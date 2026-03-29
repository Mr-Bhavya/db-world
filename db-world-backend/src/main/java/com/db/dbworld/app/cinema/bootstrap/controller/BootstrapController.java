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

    @GetMapping
    public ApiResponse<Void> bootstrap() {

        bootstrapService.bootstrap();

        return ApiResponse.success("Catalog bootstrap completed");
    }
}
