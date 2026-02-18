package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.services.cinema.SpokenLanguageService;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/spoken-language")
public class SpokenLanguageController {

    private final SpokenLanguageService spokenLanguageService;

    public SpokenLanguageController(SpokenLanguageService spokenLanguageService) {
        this.spokenLanguageService = spokenLanguageService;
    }

    @PostMapping("/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> updateSpokenLanguage() {
        spokenLanguageService.updateLanguagesFromTMDB();
        return ApiResponse.success("Spoken languages updated successfully from TMDB");
    }
}
