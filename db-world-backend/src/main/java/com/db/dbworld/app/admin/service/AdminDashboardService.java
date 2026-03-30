package com.db.dbworld.app.admin.service;

import com.db.dbworld.app.admin.dto.AdminDashboardDto;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.catalog.repository.RecordTagRepository;
import com.db.dbworld.app.cinema.enums.RecordTagType;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.enums.SyncStatus;
import com.db.dbworld.app.cinema.tmdb.sync.repository.TmdbRecordSyncRepository;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import com.db.dbworld.core.role.enums.Role;
import com.db.dbworld.core.user.repository.UserRepository;
//import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final UserRepository          userRepository;
    private final RecordRepository        recordRepository;
    private final TmdbRecordSyncRepository syncRepository;
    private final RecordTagRepository     tagRepository;
    private final MediaFileRepository mediaFileRepository;

    @Transactional(readOnly = true)
    public AdminDashboardDto getStats() {
        return AdminDashboardDto.builder()
                .users(buildUserStats())
                .records(buildRecordStats())
                .sync(buildSyncStats())
                .media(buildMediaStats())
                .system(buildSystemStats())
                .tags(buildTagStats())
                .recentRecords(buildRecentRecords())
                .build();
    }

    /* ── Sections ──────────────────────────────────────────────────────────── */

    private AdminDashboardDto.UserStats buildUserStats() {
        long total   = userRepository.count();
        long owners  = userRepository.countByRoleName(Role.OWNER);
        long admins  = userRepository.countByRoleName(Role.ADMIN);
        long viewers = userRepository.countByRoleName(Role.VIEWER);
        return AdminDashboardDto.UserStats.builder()
                .total(total)
                .owners(owners)
                .admins(admins)
                .viewers(viewers)
                .build();
    }

    private AdminDashboardDto.RecordStats buildRecordStats() {
        long total   = recordRepository.count();
        long movies  = recordRepository.countByType(RecordType.MOVIE);
        long series  = recordRepository.countByType(RecordType.TV_SERIES);
        return AdminDashboardDto.RecordStats.builder()
                .total(total)
                .movies(movies)
                .series(series)
                .build();
    }

    private AdminDashboardDto.SyncStats buildSyncStats() {
        long total   = syncRepository.count();
        long synced  = syncRepository.countByStatus(SyncStatus.SUCCESS);
        long pending = syncRepository.countByStatus(SyncStatus.RUNNING);
        long failed  = syncRepository.countByStatus(SyncStatus.FAILED);

        Instant lastSyncedAt = syncRepository
                .findTopByOrderByLastSyncedAtDesc()
                .map(e -> e.getLastSyncedAt())
                .orElse(null);

        return AdminDashboardDto.SyncStats.builder()
                .total(total)
                .synced(synced)
                .pending(pending)
                .failed(failed)
                .lastSyncedAt(lastSyncedAt)
                .build();
    }

    private AdminDashboardDto.MediaStats buildMediaStats() {
        long total = mediaFileRepository.count();
        return AdminDashboardDto.MediaStats.builder()
                .totalFiles(total)
                .build();
    }

    private AdminDashboardDto.SystemStats buildSystemStats() {
        Runtime rt       = Runtime.getRuntime();
        long memTotal    = rt.totalMemory() / (1024 * 1024);
        long memFree     = rt.freeMemory()  / (1024 * 1024);
        long memUsed     = memTotal - memFree;
        double memPercent = memTotal > 0 ? (memUsed * 100.0 / memTotal) : 0;

        // JVM uptime
        long uptimeMs = ManagementFactory.getRuntimeMXBean().getUptime();
        long hours    = TimeUnit.MILLISECONDS.toHours(uptimeMs);
        long minutes  = TimeUnit.MILLISECONDS.toMinutes(uptimeMs) % 60;
        String uptime = hours + "h " + minutes + "m";

        // CPU (JVM process) — not per-core OS-level, but available without native libs
        double cpuPercent = 0;
        try {
            com.sun.management.OperatingSystemMXBean osBean =
                (com.sun.management.OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();
            cpuPercent = osBean.getProcessCpuLoad() * 100;
        } catch (Exception ignored) {}

        return AdminDashboardDto.SystemStats.builder()
                .cpuPercent(Math.max(0, cpuPercent))
                .memUsedMb(memUsed)
                .memTotalMb(memTotal)
                .memPercent(memPercent)
                .uptime(uptime)
                .build();
    }

    private AdminDashboardDto.TagStats buildTagStats() {
        return AdminDashboardDto.TagStats.builder()
                .trending(    safeTagCount(RecordTagType.TRENDING))
                .featured(    safeTagCount(RecordTagType.FEATURED))
                .editorPick(  safeTagCount(RecordTagType.EDITOR_PICK))
                .availableForDownload(   safeTagCount(RecordTagType.AVAILABLE_FOR_DOWNLOAD))
                .recentlyAdded(safeTagCount(RecordTagType.RECENTLY_ADDED))
                .top10(        safeTagCount(RecordTagType.TOP_10))
                .build();
    }

    private long safeTagCount(RecordTagType type) {
        try { return tagRepository.countByTagType(type); }
        catch (Exception e) { return 0; }
    }

    private List<AdminDashboardDto.RecentRecord> buildRecentRecords() {
        return recordRepository.findAll(
                        PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent()
                .stream()
                .map(r -> AdminDashboardDto.RecentRecord.builder()
                        .id(r.getId())
                        .name(r.getName())
                        .type(r.getType() != null ? r.getType().name() : null)
                        .tmdbPosterPath(r.getTmdb() != null ? r.getTmdb().getPosterPath() : null)
                        .createdAt(r.getCreatedAt())
                        .build())
                .collect(Collectors.toList());
    }
}
