package com.db.dbworld.app.cinema.progress.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;

@Getter
@Setter
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(
    name = "WATCH_PROGRESS",
    schema = "new_db_world",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_user_file_progress",
        columnNames = {"user_id", "file_id"}
    )
)
public class WatchProgressEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "file_id", nullable = false, length = 128)
    private String fileId;

    @Column(name = "record_id")
    private Long recordId;

    @Column(name = "position_ms", nullable = false)
    private Long positionMs;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "audio_lang", length = 32)
    private String audioLang;

    @Column(name = "sub_lang", length = 32)
    private String subLang;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
