package com.db.dbworld.app.cinema.progress.service;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.progress.dto.ContinueWatchingDto;
import com.db.dbworld.app.cinema.progress.entity.WatchProgressEntity;
import com.db.dbworld.app.cinema.progress.repository.WatchProgressRepository;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.ImageEntity;
import com.db.dbworld.app.cinema.tmdb.media.entity.LogoImageEntity;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import lombok.Builder;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Log4j2
@Service
@RequiredArgsConstructor
@Transactional
public class WatchProgressService {

    /** Threshold (fraction) above which a save is treated as a "completed" milestone. */
    private static final double COMPLETION_THRESHOLD = 0.95;
    /** A title is also "finished" once watched to within this much of the end. */
    private static final long   COMPLETION_TAIL_MS   = 600_000L; // 10 minutes
    private static final Pattern SEASON_EPISODE_PATTERN =
            Pattern.compile("(?i)[._ -]S(\\d{1,2})E(\\d{1,3})(?:[._ -]|$)");

    private final WatchProgressRepository       repository;
    private final RecordRepository              recordRepository;
    private final MediaInfoService              mediaInfoService;

    @Value
    @Builder
    public static class ProgressDto {
        String fileId;
        Long recordId;
        Long positionMs;
        Long durationMs;
        String audioLang;
        String subLang;
        Instant updatedAt;
    }

    public void saveProgress(Long userId, String fileId, Long recordId,
                              Long positionMs, Long durationMs,
                              String audioLang, String subLang) {
        // Atomic upsert: the player can fire two saves for the same (user, file) within
        // milliseconds. The prior find-then-insert flow raced and surfaced the
        // uk_user_file_progress duplicate-key error. ON DUPLICATE KEY UPDATE resolves it
        // server-side without us needing locking or retries.
        repository.upsert(
                userId, fileId, recordId,
                positionMs, durationMs,
                audioLang, subLang,
                Instant.now()
        );

        // Milestone logging — keep per-second ticks at DEBUG; promote to INFO only when
        // the user has reached the ≥95% completion threshold (will fire repeatedly on
        // subsequent saves near the end of a file — acceptable for "completed" status).
        boolean completed = durationMs != null && durationMs > 0 && positionMs != null
                && ((double) positionMs / (double) durationMs) >= COMPLETION_THRESHOLD;
        if (completed) {
            log.info("Watch progress at completion (≥95%): userId={}, fileId={}, recordId={}, positionMs={}, durationMs={}",
                    userId, fileId, recordId, positionMs, durationMs);
        } else {
            log.debug("Watch progress saved: userId={}, fileId={}, positionMs={}, durationMs={}",
                    userId, fileId, positionMs, durationMs);
        }
    }

    public Optional<ProgressDto> getProgress(Long userId, String fileId) {
        return repository.findByUserIdAndFileId(userId, fileId).map(this::toDto);
    }

    public List<ProgressDto> getRecentProgress(Long userId, int days) {
        Instant cutoff = Instant.now().minus(days, ChronoUnit.DAYS);
        return repository
                .findByUserIdAndUpdatedAtAfterOrderByUpdatedAtDesc(userId, cutoff)
                .stream().map(this::toDto).collect(Collectors.toList());
    }

    // ── Continue Watching ─────────────────────────────────────────────────────

    /**
     * Builds the Continue Watching list: one tile per record (its most-recent
     * progress), with the resume target and completion handling.
     *  - Movie finished (last 10 min or ≥95%) → dropped.
     *  - Series: in-progress episode → resume it; finished episode → resume the
     *    NEXT episode at 0; finished last available episode → dropped.
     */
    @Transactional(readOnly = true)
    public List<ContinueWatchingDto> getContinueWatching(Long userId) {
        Map<Long, WatchProgressEntity> latestByRecord = new LinkedHashMap<>();
        for (WatchProgressEntity wp : repository.findByUserIdOrderByUpdatedAtDesc(userId)) {
            if (wp.getRecordId() != null) {
                latestByRecord.putIfAbsent(wp.getRecordId(), wp); // first seen = newest (rows are DESC)
            }
        }
        List<ContinueWatchingDto> out = new ArrayList<>();
        for (Map.Entry<Long, WatchProgressEntity> e : latestByRecord.entrySet()) {
            ContinueWatchingDto dto = buildContinueItem(e.getKey(), e.getValue());
            if (dto != null) out.add(dto);
        }
        return out;
    }

    /** Remove from Continue Watching — drops all of the user's progress for a record. */
    public long removeRecord(Long userId, Long recordId) {
        return repository.deleteByUserIdAndRecordId(userId, recordId);
    }

    /** Drops a single file's progress for a user. */
    public long removeFile(Long userId, String fileId) {
        return repository.deleteByUserIdAndFileId(userId, fileId);
    }

    private ContinueWatchingDto buildContinueItem(Long recordId, WatchProgressEntity latest) {
        RecordEntity record = recordRepository.findByIdWithTmdb(recordId).orElse(null);
        if (record == null) return null;

        long pos = nz(latest.getPositionMs());
        long dur = nz(latest.getDurationMs());
        boolean finished = isFinished(pos, dur);

        String  resumeFileId = latest.getFileId();
        Integer season = null, episode = null;
        long    resumePos = pos, resumeDur = dur;

        if (record.getType() == RecordType.TV_SERIES) {
            List<MediaFileDto> files = mediaInfoService.getByRecordId(recordId);
            int[] curSE = seOf(fileById(files, latest.getFileId()));
            if (finished) {
                MediaFileDto next = nextEpisodeFile(files, curSE);
                if (next == null) return null; // last available episode finished → all watched
                resumeFileId = next.getId();
                int[] nse = seOf(next);
                if (nse != null) { season = nse[0]; episode = nse[1]; }
                resumePos = 0;
                resumeDur = 0; // unknown until the next episode is played
            } else if (curSE != null) {
                season = curSE[0];
                episode = curSE[1];
            }
        } else if (finished) {
            return null; // movie finished → drop
        }

        TmdbEntity tmdb = record.getTmdb();
        return ContinueWatchingDto.builder()
                .recordId(recordId)
                .title(record.getName())
                .type(record.getType().name())
                .posterPath(tmdb != null ? tmdb.getPosterPath() : null)
                .backdropPath(tmdb != null ? tmdb.getBackdropPath() : null)
                .logoPath(tmdb != null ? selectLogoPath(tmdb.getImages()) : null)
                .resumeFileId(resumeFileId)
                .season(season)
                .episode(episode)
                .positionMs(resumePos)
                .durationMs(resumeDur)
                .updatedAt(latest.getUpdatedAt())
                .build();
    }

    // Title-logo selection (locale-best: hi > en > gu > language-neutral) — mirrors
    // the catalog/detail logo pick so Continue Watching shows the same wordmark.
    private static final List<String> LOGO_LOCALES = List.of("hi", "en", "gu");

    private static String selectLogoPath(List<ImageEntity> images) {
        if (images == null) return null;
        String best = null;
        int bestScore = -1;
        for (ImageEntity img : images) {
            if (!(img instanceof LogoImageEntity logo) || logo.getFilePath() == null) continue;
            int score = logoLocaleScore(logo.getIso6391());
            if (score <= 0) continue; // keep en/hi/gu/neutral only
            if (score > bestScore) {
                bestScore = score;
                best = logo.getFilePath();
            }
        }
        return best;
    }

    private static int logoLocaleScore(String iso) {
        if (iso == null) return 1;                       // language-neutral logo
        int idx = LOGO_LOCALES.indexOf(iso);
        return idx >= 0 ? (LOGO_LOCALES.size() - idx) * 10 : 0;  // hi > en > gu > other
    }

    private boolean isFinished(long pos, long dur) {
        if (dur <= 0) return false;
        return pos >= dur - COMPLETION_TAIL_MS || ((double) pos / dur) >= COMPLETION_THRESHOLD;
    }

    private MediaFileDto fileById(List<MediaFileDto> files, String id) {
        if (id == null) return null;
        return files.stream().filter(f -> id.equals(f.getId())).findFirst().orElse(null);
    }

    /** Season/episode from the tmdb columns, falling back to the canonical SxxExx filename. */
    private int[] seOf(MediaFileDto f) {
        if (f == null) return null;
        if (f.getTmdbSeasonNumber() != null && f.getTmdbEpisodeNumber() != null) {
            return new int[]{ f.getTmdbSeasonNumber(), f.getTmdbEpisodeNumber() };
        }
        if (f.getFileName() == null) return null;
        Matcher m = SEASON_EPISODE_PATTERN.matcher(f.getFileName());
        if (!m.find()) return null;
        try {
            return new int[]{ Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)) };
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** The earliest episode strictly after {@code cur} (by season, then episode). */
    private MediaFileDto nextEpisodeFile(List<MediaFileDto> files, int[] cur) {
        if (cur == null) return null;
        MediaFileDto best = null;
        int[] bestSE = null;
        for (MediaFileDto f : files) {
            int[] se = seOf(f);
            if (se == null || cmpSE(se, cur) <= 0) continue;
            if (bestSE == null || cmpSE(se, bestSE) < 0) { best = f; bestSE = se; }
        }
        return best;
    }

    private int cmpSE(int[] a, int[] b) {
        return a[0] != b[0] ? Integer.compare(a[0], b[0]) : Integer.compare(a[1], b[1]);
    }

    private static long nz(Long v) { return v != null ? v : 0L; }

    private ProgressDto toDto(WatchProgressEntity e) {
        return ProgressDto.builder()
                .fileId(e.getFileId()).recordId(e.getRecordId())
                .positionMs(e.getPositionMs()).durationMs(e.getDurationMs())
                .audioLang(e.getAudioLang()).subLang(e.getSubLang())
                .updatedAt(e.getUpdatedAt()).build();
    }
}
