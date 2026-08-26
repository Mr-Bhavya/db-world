package com.db.dbworld.app.cinema.tmdb.collection.service;

import com.db.dbworld.app.cinema.tmdb.collection.dto.CollectionDetailDto;

public interface CollectionService {

    /**
     * The collection plus every film in it, each marked with the local record that
     * backs it when the library holds one the caller may open.
     */
    CollectionDetailDto getCollection(Long collectionId);
}
