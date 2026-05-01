package com.db.dbworld.app.cinema.interaction.service;

import com.db.dbworld.app.cinema.interaction.dto.InteractionDto;

import java.util.List;

public interface InteractionService {

    /* ADD */

    void addToWatchlist(Long userId, Long recordId);

    void like(Long userId, Long recordId);

    void love(Long userId, Long recordId);

    void markWatched(Long userId, Long recordId);

    /* REMOVE */

    void removeFromWatchlist(Long userId, Long recordId);

    void unlike(Long userId, Long recordId);

    void unlove(Long userId, Long recordId);

    void unmarkWatched(Long userId, Long recordId);

    /* PROGRESS */

    void updateProgress(Long userId, Long recordId, Integer progress);

    /* GET */
    InteractionDto getInteraction(Long userId, Long recordId);

    List<InteractionDto> getInteractions(Long userId, List<Long> recordIds);
}
