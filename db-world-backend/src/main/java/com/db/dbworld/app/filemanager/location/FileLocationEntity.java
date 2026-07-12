package com.db.dbworld.app.filemanager.location;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "file_manager_location", schema = "db_world",
        uniqueConstraints = @UniqueConstraint(name = "uk_fm_location_path", columnNames = "absolute_path"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FileLocationEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 120) private String label;
    @Column(name = "absolute_path", nullable = false, length = 1000) private String absolutePath;
    @Column(nullable = false) private boolean enabled;
    @Column(nullable = false) private int sortOrder;

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
