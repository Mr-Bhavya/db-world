package com.db.dbworld.app.cinema.catalog.tags.services;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.media.info.dto.MediaFileDto;
import com.db.dbworld.app.media.info.service.MediaInfoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Flags a TV record as having genuinely-new content at ingest, so the NEW_SEASON /
 * NEW_EPISODE tag strategies can resurface it on the home rail (see those strategies).
 *
 * <p>Novelty is judged against the record's <b>existing media files</b> — a season/episode
 * the library didn't already have. Re-uploading or adding a quality variant of an episode
 * that already exists changes nothing. Movies are ignored entirely.
 *
 * <p>Season/episode are parsed from the canonical {@code …SxxExx…} filenames (reliable
 * regardless of whether the tmdb_*_number columns were populated).
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class NewContentTaggingService {

    private static final Pattern SEASON_EPISODE_PATTERN =
            Pattern.compile("(?i)[._ -]S(\\d{1,2})E(\\d{1,3})(?:[._ -]|$)");
    private static final int WINDOW_DAYS = 30;

    private final RecordRepository recordRepository;
    private final MediaInfoService mediaInfoService;

    /**
     * @param recordId      the record the file was just linked to
     * @param currentFileId the just-persisted media file's id (excluded from the "existing" set)
     * @param season        the new file's season (from the ingestion context), may be null
     * @param episode       the new file's episode, may be null
     */
    @Transactional
    public void evaluate(Long recordId, String currentFileId, Integer season, Integer episode) {
        if (recordId == null || season == null) {
            return; // not a season/episode (movie or unknown) — skip
        }

        RecordEntity record = recordRepository.findById(recordId).orElse(null);
        if (record == null || record.getType() != RecordType.TV_SERIES) {
            return; // movies are skipped
        }

        // Build the set of (season, episode) the record already had, excluding this file.
        Set<Integer> existingSeasons = new HashSet<>();
        Set<Long>    existingPairs   = new HashSet<>();
        List<MediaFileDto> files = mediaInfoService.getByRecordId(recordId);
        for (MediaFileDto f : files) {
            if (f.getId() != null && f.getId().equals(currentFileId)) continue;
            int[] se = resolveSeasonEpisode(f);
            if (se == null) continue;
            existingSeasons.add(se[0]);
            existingPairs.add(pair(se[0], se[1]));
        }

        final String kind;
        if (!existingSeasons.contains(season)) {
            kind = "NEW_SEASON";
        } else if (episode != null && !existingPairs.contains(pair(season, episode))) {
            kind = "NEW_EPISODE";
        } else {
            return; // (S,E) already present → re-upload / quality variant → no change
        }

        applyKind(record, kind);
        recordRepository.save(record);
        log.info("New-content flag set; recordId={}, kind={}, S{}E{}", recordId, kind, season, episode);
    }

    /**
     * NEW_SEASON wins over NEW_EPISODE within the active window, so ingesting a whole new
     * season (episode-by-episode) keeps the record badged "New Season" rather than being
     * downgraded to "New Episode" by the later files of that same pack.
     */
    private void applyKind(RecordEntity record, String kind) {
        Instant now = Instant.now();
        boolean seasonStillActive = "NEW_SEASON".equals(record.getNewContentKind())
                && record.getNewContentAt() != null
                && record.getNewContentAt().isAfter(now.minus(WINDOW_DAYS, ChronoUnit.DAYS));

        if ("NEW_EPISODE".equals(kind) && seasonStillActive) {
            record.setNewContentAt(now); // keep NEW_SEASON, just refresh recency
        } else {
            record.setNewContentKind(kind);
            record.setNewContentAt(now);
        }
    }

    private int[] resolveSeasonEpisode(MediaFileDto f) {
        if (f.getTmdbSeasonNumber() != null) {
            return new int[]{ f.getTmdbSeasonNumber(), f.getTmdbEpisodeNumber() != null ? f.getTmdbEpisodeNumber() : -1 };
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

    /** Packs (season, episode) into a single long key for set membership. */
    private long pair(int season, int episode) {
        return ((long) season << 20) | (episode & 0xFFFFF);
    }
}
