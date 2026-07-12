package com.db.dbworld.app.filemanager.upload;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "file_upload_session", schema = "db_world")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UploadSessionEntity {

    @Id @GeneratedValue(strategy = GenerationType.UUID) @Column(length = 36)
    private String id;

    @Column(nullable = false, length = 36)   private String locationId;
    @Column(nullable = false, length = 1000) private String targetPath;
    @Column(nullable = false, length = 500)  private String fileName;
    @Column(nullable = false) private long totalSize;
    @Column(nullable = false) private int chunkSize;
    @Column(nullable = false) private long receivedBytes;
    @Column(nullable = false) private int nextIndex;
    @Column(length = 128) private String checksum;
    @Column(nullable = false, length = 20) private String onConflict;
    @Column(nullable = false, length = 20) private String status; // always PENDING — the row is deleted (not updated) on completion

    @CreationTimestamp @Column(nullable = false, updatable = false) private Instant createdAt;
    @UpdateTimestamp   @Column(nullable = false)                    private Instant updatedAt;
}
