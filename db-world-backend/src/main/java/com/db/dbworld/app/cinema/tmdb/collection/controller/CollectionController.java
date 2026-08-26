package com.db.dbworld.app.cinema.tmdb.collection.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDetailDto;
import com.db.dbworld.app.cinema.tmdb.collection.service.CollectionService;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cinema/collections")
@RequiredArgsConstructor
public class CollectionController {

    private final CollectionService collectionService;

    /** GET /api/cinema/collections/{id} */
    @GetMapping("/{id}")
    public ApiResponse<CollectionDetailDto> getCollection(@PathVariable Long id) {
        return ApiResponse.success(collectionService.getCollection(id));
    }
}
