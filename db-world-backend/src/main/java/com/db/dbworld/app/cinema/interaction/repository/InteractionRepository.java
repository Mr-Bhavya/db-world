package com.db.dbworld.app.cinema.interaction.repository;

import com.db.dbworld.app.cinema.interaction.entity.UserInteractionEntity;
import com.db.dbworld.app.cinema.interaction.enums.InteractionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface InteractionRepository
        extends JpaRepository<UserInteractionEntity, Long> {

    Optional<UserInteractionEntity> findByUserIdAndRecordIdAndInteractionType(
            Long userId,
            Long recordId,
            InteractionType type
    );

    List<UserInteractionEntity> findByUserIdAndInteractionType(
            Long userId,
            InteractionType type
    );

    Page<UserInteractionEntity> findByUserIdAndInteractionTypeOrderByIdDesc(
            Long userId,
            InteractionType type,
            Pageable pageable
    );

    boolean existsByUserIdAndInteractionType(Long userId, InteractionType type);

    @Query("""
                SELECT ui
                FROM UserInteractionEntity ui
                WHERE ui.userId = :userId
                AND ui.record.id IN :recordIds
            """)
    List<UserInteractionEntity> findAllByUserIdAndRecordIds(
            Long userId,
            List<Long> recordIds
    );

}