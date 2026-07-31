package com.db.dbworld.app.brand;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.core.role.annotations.AnyRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Authenticated brand/site search — proxies logo.dev's Brand Search API so the
 * secret key stays server-side. Used by the vault's "Add credential" URL field
 * to suggest sites/apps that aren't already saved. Generic on purpose: any
 * feature that needs name→domain+logo suggestions can call it.
 */
@Log4j2
@RestController
@RequestMapping("/api/brand")
@RequiredArgsConstructor
public class BrandController {

    private final BrandSearchService service;

    @GetMapping("/search")
    @AnyRole
    public ApiResponse<List<BrandSuggestion>> search(
            @RequestParam(name = "q", required = false) String q) {
        return ApiResponse.success(service.search(q));
    }
}
