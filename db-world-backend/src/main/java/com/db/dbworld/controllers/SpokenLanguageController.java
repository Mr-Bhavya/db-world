package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.services.cinema.SpokenLanguageService;
import com.db.dbworld.utils.DbWorldConstants;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping(value = "/api/spoken-language")
public class SpokenLanguageController {

    @Autowired
    private SpokenLanguageService spokenLanguageService;

    @PostMapping(value = "/")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> updateSpokenLanguage() {
        spokenLanguageService.updateLanguagesFromTMDB();
        return new ApiResponse<>(HttpStatus.OK, true, "Spoken Languages table is updated successfully from TMDB data." );
    }
}
