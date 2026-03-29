package com.db.dbworld.app.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class AdminDashboardDto {

    private UserStats      users;
    private RecordStats    records;
    private SyncStats      sync;
    private MediaStats     media;
    private SystemStats    system;
    private TagStats       tags;
    private List<RecentRecord> recentRecords;

    /* ── Nested DTOs ──────────────────────────────────────────────────────── */

    @Data @Builder
    public static class UserStats {
        private long total;
        private long owners;
        private long admins;
        private long viewers;
    }

    @Data @Builder
    public static class RecordStats {
        private long total;
        private long movies;
        private long series;
    }

    @Data @Builder
    public static class SyncStats {
        private long total;
        private long synced;
        private long pending;
        private long failed;
        private Instant lastSyncedAt;
    }

    @Data @Builder
    public static class MediaStats {
        private long totalFiles;
    }

    @Data @Builder
    public static class SystemStats {
        private double cpuPercent;
        private long   memUsedMb;
        private long   memTotalMb;
        private double memPercent;
        private String uptime;
    }

    @Data @Builder
    public static class TagStats {
        private long trending;
        private long featured;
        private long newRelease;
        private long editorPick;
        private long showOnTop;
        private long recentlyAdded;
        private long top10;
    }

    @Data @Builder
    public static class RecentRecord {
        private Long   id;
        private String name;
        private String type;
        private String tmdbPosterPath;
        private Instant createdAt;
    }
}
