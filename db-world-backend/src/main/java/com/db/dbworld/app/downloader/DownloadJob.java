package com.db.dbworld.app.downloader;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "media_download_job", indexes = {
        @Index(name = "idx_download_owner_created", columnList = "owner,createdAt"),
        @Index(name = "idx_download_expiry", columnList = "expiresAt")
})
@Getter
@Setter
public class DownloadJob {
    @Id private String id;
    @Column(nullable = false) private String owner;
    @Column(nullable = false, length = 4096) private String url;
    @Column(length = 1000) private String title;
    @Column(length = 4096) private String thumbnail;
    private String preset;
    private String quality;
    private String videoFormat;
    private String audioFormat;
    private String container;
    private String status;
    private String fileName;
    private long bytesDownloaded;
    private long bytesTotal;
    private double speed;
    private Long eta;
    private Double progress;
    @Column(length = 1500) private String error;
    private Instant createdAt;
    private Instant completedAt;
    private Instant expiresAt;
    private boolean subtitles;
    private boolean thumbnailFile;
    private String subtitleLanguage;
    private String audioLanguage;
    private Double startSeconds;
    private Double endSeconds;
}