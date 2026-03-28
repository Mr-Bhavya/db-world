package com.db.dbworld.app.cinema.interaction.service.impl;

import com.db.dbworld.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.cinema.interaction.cache.InteractionCacheService;
import com.db.dbworld.cinema.interaction.dto.InteractionDto;
import com.db.dbworld.cinema.interaction.entity.UserInteractionEntity;
import com.db.dbworld.cinema.interaction.enums.InteractionType;
import com.db.dbworld.cinema.interaction.repository.InteractionRepository;
import com.db.dbworld.cinema.interaction.service.InteractionService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional
public class InteractionServiceImpl implements InteractionService {

    private final InteractionRepository repository;
    private final RecordRepository recordRepository;
    private final InteractionCacheService cacheService;

    /* =========================
       ADD INTERACTIONS (POST)
       ========================= */

    @Override
    public void addToWatchlist(Long userId, Long recordId) {
        saveInteraction(userId, recordId, InteractionType.WATCHLIST);
    }

    @Override
    public void like(Long userId, Long recordId) {
        saveInteraction(userId, recordId, InteractionType.LIKE);
    }

    @Override
    public void love(Long userId, Long recordId) {
        saveInteraction(userId, recordId, InteractionType.LOVE);
    }

    @Override
    public void markWatched(Long userId, Long recordId) {
        saveInteraction(userId, recordId, InteractionType.WATCHED);
    }

    /* =========================
       REMOVE INTERACTIONS (DELETE)
       ========================= */

    @Override
    public void removeFromWatchlist(Long userId, Long recordId) {
        deleteInteraction(userId, recordId, InteractionType.WATCHLIST);
    }

    @Override
    public void unlike(Long userId, Long recordId) {
        deleteInteraction(userId, recordId, InteractionType.LIKE);
    }

    @Override
    public void unlove(Long userId, Long recordId) {
        deleteInteraction(userId, recordId, InteractionType.LOVE);
    }

    @Override
    public void unmarkWatched(Long userId, Long recordId) {
        deleteInteraction(userId, recordId, InteractionType.WATCHED);
    }

    /* =========================
       PROGRESS
       ========================= */

    @Override
    public void updateProgress(Long userId, Long recordId, Integer progress) {

        UserInteractionEntity interaction =
                repository.findByUserIdAndRecordIdAndInteractionType(
                        userId,
                        recordId,
                        InteractionType.PROGRESS
                ).orElseGet(() -> UserInteractionEntity.builder()
                        .userId(userId)
                        .record(recordRepository.getReferenceById(recordId))
                        .interactionType(InteractionType.PROGRESS)
                        .build());

        interaction.setProgress(progress);
        repository.save(interaction);

        // ✅ Direct cache update (NO DB read)
        cacheService.updateField(
                userId,
                recordId,
                InteractionType.PROGRESS,
                true,
                progress
        );
    }

    /* =========================
       READ
       ========================= */

    @Override
    public InteractionDto getInteraction(Long userId, Long recordId) {

        return getInteractions(userId, List.of(recordId))
                .stream()
                .findFirst()
                .orElseGet(() -> buildDefaultDto(recordId));
    }

    @Override
    public List<InteractionDto> getInteractions(Long userId, List<Long> recordIds) {

        // 1. Cache lookup
        Map<Long, InteractionDto> cached = cacheService.getBatch(userId, recordIds);

        List<Long> missingIds = recordIds.stream()
                .filter(id -> !cached.containsKey(id))
                .toList();

        Map<Long, InteractionDto> result = new HashMap<>(cached);

        // 2. DB fetch for missing
        if (!missingIds.isEmpty()) {

            List<UserInteractionEntity> interactions =
                    repository.findAllByUserIdAndRecordIds(userId, missingIds);

            Map<Long, InteractionDto> dbMap = new HashMap<>();

            // Initialize defaults
            for (Long recordId : missingIds) {
                dbMap.put(recordId, buildDefaultDto(recordId));
            }

            // Map DB → DTO
            for (UserInteractionEntity entity : interactions) {

                Long recordId = entity.getRecord().getId();
                InteractionDto dto = dbMap.get(recordId);

                if (dto == null) continue;

                switch (entity.getInteractionType()) {
                    case LIKE -> dto.setLiked(true);
                    case LOVE -> dto.setLoved(true);
                    case WATCHLIST -> dto.setWatchlisted(true);
                    case WATCHED -> dto.setWatched(true);
                    case PROGRESS -> dto.setProgress(entity.getProgress());
                }
            }

            // 3. Cache populate
            cacheService.putBatch(userId, dbMap);

            result.putAll(dbMap);
        }

        return new ArrayList<>(result.values());
    }

    /* =========================
       INTERNAL METHODS
       ========================= */

    private void saveInteraction(Long userId, Long recordId, InteractionType type) {

        boolean exists = repository
                .findByUserIdAndRecordIdAndInteractionType(userId, recordId, type)
                .isPresent();

        if (!exists) {
            repository.save(
                    UserInteractionEntity.builder()
                            .userId(userId)
                            .record(recordRepository.getReferenceById(recordId))
                            .interactionType(type)
                            .build()
            );

            // ✅ Direct cache update
            cacheService.updateField(userId, recordId, type, true, null);
        }
    }

    private void deleteInteraction(Long userId, Long recordId, InteractionType type) {

        repository.findByUserIdAndRecordIdAndInteractionType(userId, recordId, type)
                .ifPresent(entity -> {
                    repository.delete(entity);

                    // ✅ Direct cache update
                    cacheService.updateField(userId, recordId, type, false, null);
                });
    }

    private InteractionDto buildDefaultDto(Long recordId) {
        return new InteractionDto(
                recordId,
                false,
                false,
                false,
                false,
                null
        );
    }
}