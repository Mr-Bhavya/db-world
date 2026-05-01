package com.db.dbworld.app.media.info.entity;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.media.info.entity.track.TrackEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Represents a physical media file and its associated track metadata.
 *
 * Replaces the old MediaFileInfoEntity (entities.dbcinema.stream).
 * Uses RecordEntity (new cinema package) instead of DBCinemaRecordsEntity.
 *
 * Table: media_files (new_db_world schema)
 */
@Entity
@Table(
        name = "media_files",
        schema = "new_db_world",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_media_file_record_path",
                columnNames = {"record_id", "file_path"}
        )
)
@EntityListeners(AuditingEntityListener.class)
@Getter
@Setter
@NoArgsConstructor
public class MediaFileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", length = 36)
    private String id;

    /**
     * Reference to the catalog record this file belongs to.
     * Uses new cinema package.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "record_id")
    private RecordEntity record;

    @Column(name = "file_name", nullable = false, length = 1000)
    private String fileName;

    @Column(name = "file_path", nullable = false, length = 1000)
    private String filePath;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    /**
     * Ingestion job that produced this file.
     * Links back to IngestionJobEntity.jobId for traceability.
     */
    @Column(name = "ingestion_job_id", length = 36)
    private String ingestionJobId;

    /**
     * Full raw JSON from `mediainfo --output=JSON`.
     * MySQL JSON type — validated, indexable via JSON_EXTRACT(), schema-less.
     * Allows re-parsing without re-running the mediainfo command.
     */
    @Column(name = "raw_media_info_json", columnDefinition = "JSON")
    private String rawMediaInfoJson;

    @Column(name = "tmdb_season_number")
    private Integer tmdbSeasonNumber;

    @Column(name = "tmdb_episode_number")
    private Integer tmdbEpisodeNumber;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(
            mappedBy = "mediaFile",
            cascade = CascadeType.ALL,
            orphanRemoval = true,
            fetch = FetchType.LAZY
    )
    private List<TrackEntity> tracks = new ArrayList<>();

    public void addTrack(TrackEntity track) {
        track.setMediaFile(this);
        tracks.add(track);
    }
}
