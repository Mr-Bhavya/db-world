package com.db.dbworld.app.media.info.entity;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.media.info.entity.track.TrackEntity;
import com.db.dbworld.app.media.storyboard.MediaFileStoryboardCleanupListener;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.CRC32;

/**
 * Represents a physical media file and its associated track metadata.
 *
 * Replaces the old MediaFileInfoEntity (entities.dbcinema.stream).
 * Uses RecordEntity (new cinema package) instead of DBCinemaRecordsEntity.
 *
 * Table: media_files (db_world schema)
 */
@Entity
@Table(
        name = "media_files",
        schema = "db_world",
        // Uniqueness keyed on file_path_hash rather than the raw VARCHAR(1000): on utf8mb4,
        // (record_id, file_path) is ~4008 bytes and exceeds MySQL's index key-length limit.
        uniqueConstraints = @UniqueConstraint(
                name = "uq_media_file_record_path_hash",
                columnNames = {"record_id", "file_path_hash"}
        ),
        indexes = {
                // ingestion_job_id is a plain column (not a FK) looked up by findByIngestionJobId.
                @Index(name = "idx_media_files_ingestion_job", columnList = "ingestion_job_id"),
                // Indexable exact-match key for file_path (see filePathHash); lookups pair it
                // with a full file_path check, so this stays useful even for 1000-char paths.
                @Index(name = "idx_media_files_path_hash", columnList = "file_path_hash")
        }
)
@EntityListeners({AuditingEntityListener.class, MediaFileStoryboardCleanupListener.class})
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

    /**
     * CRC32 of {@link #filePath}, kept in sync by {@link #syncFilePathHash()}.
     *
     * file_path is VARCHAR(1000) — too long to index or unique directly (see @Table). This
     * fixed-width hash is indexed instead and forms the uniqueness key with record_id. Every
     * lookup pairs the hash with a full file_path comparison, so a CRC32 collision only costs
     * an extra row check — never a wrong result. Uses CRC32 specifically because it matches
     * MySQL's CRC32(), letting existing rows be backfilled in pure SQL.
     */
    @Column(name = "file_path_hash", nullable = false)
    private long filePathHash;

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

    // ── Scrub-preview storyboard (sprite sheet of thumbnail frames) ───────────
    // Generated at ingest; sprite lives at {storyboards}/{id}.jpg and is served
    // by the CDN. Null on older files that predate the feature → no preview frame.
    @Column(name = "storyboard_interval_ms")
    private Integer storyboardIntervalMs;   // ms between consecutive tiles

    @Column(name = "storyboard_cols")
    private Integer storyboardCols;         // tiles per row in the sprite

    @Column(name = "storyboard_rows")
    private Integer storyboardRows;         // tile rows in the sprite

    @Column(name = "storyboard_tile_w")
    private Integer storyboardTileW;        // single tile width (px)

    @Column(name = "storyboard_tile_h")
    private Integer storyboardTileH;        // single tile height (px)

    @Column(name = "storyboard_count")
    private Integer storyboardCount;        // total tiles (≤ cols*rows)

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

    /** Keep {@link #filePathHash} consistent with {@link #filePath} on every insert/update. */
    @PrePersist
    @PreUpdate
    void syncFilePathHash() {
        this.filePathHash = hashPath(this.filePath);
    }

    /**
     * CRC32 of the UTF-8 bytes of {@code path} — matches MySQL's {@code CRC32()} so the DB
     * backfill agrees with the app. Returns 0 for null (which never persists: file_path is
     * NOT NULL). Callers building a lookup key must use this exact method.
     */
    public static long hashPath(String path) {
        if (path == null) return 0L;
        CRC32 crc = new CRC32();
        crc.update(path.getBytes(StandardCharsets.UTF_8));
        return crc.getValue();
    }
}
