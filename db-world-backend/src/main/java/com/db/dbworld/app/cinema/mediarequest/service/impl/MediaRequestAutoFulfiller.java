package com.db.dbworld.app.cinema.mediarequest.service.impl;

import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.common.events.MediaFilesChangedEvent;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestEntity;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestKind;
import com.db.dbworld.app.cinema.mediarequest.entity.MediaRequestScope;
import com.db.dbworld.app.cinema.mediarequest.repository.MediaRequestRepository;
import com.db.dbworld.app.cinema.mediarequest.service.MediaRequestService;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.EpisodeEntity;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.media.info.entity.MediaFileEntity;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Closes media requests the library has just answered.
 *
 * <p>Requests were previously only ever closed by an admin ticking them off in the queue, which
 * is fine while a request means "this title is missing" and poor once it can mean "S02E05 is
 * missing": the person who asked has to be told, and the queue has to stop showing work that is
 * already done.
 *
 * <p><b>NEW_FILES only.</b> Whether an arriving file is the "higher quality" someone asked for is
 * a judgement — resolution alone doesn't settle it — and guessing wrong sends a voter a false
 * "it's here" push. Those kinds stay with the admin.
 *
 * <p>Deliberately conservative in the other direction too: a request that can't be shown to be
 * satisfied is left PENDING. An admin ticking off a done request costs a click; telling somebody
 * their episode landed when it didn't costs their trust in the notification.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MediaRequestAutoFulfiller {

    /** Recorded as the fulfiller so the admin queue distinguishes these from a human. */
    static final String ACTOR = "auto (file match)";

    private final MediaRequestRepository requestRepo;
    private final MediaFileRepository mediaFileRepo;
    private final RecordRepository recordRepo;
    private final MediaRequestService requestService;

    /**
     * AFTER_COMMIT: the file has to actually be in the database before its arrival is announced to
     * voters, and a rolled-back ingest must announce nothing. REQUIRES_NEW because the publishing
     * transaction is finished by the time this runs, and the season-gap check walks lazy TMDB
     * associations. {@code fallbackExecution} keeps it working if a caller isn't transactional.
     */
    @TransactionalEventListener(fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onMediaFilesChanged(MediaFilesChangedEvent event) {
        try {
            fulfilSatisfied(event.recordId());
        } catch (Exception e) {
            // Never let request bookkeeping break an ingest that has already succeeded.
            log.warn("Auto-fulfil failed for recordId={}: {}", event.recordId(), e.toString());
        }
    }

    /**
     * Fulfil every pending NEW_FILES request on this record whose scope the current files satisfy.
     *
     * @return how many were fulfilled
     */
    public int fulfilSatisfied(Long recordId) {
        if (recordId == null) {
            return 0;
        }
        // Cheap guard first: most ingests answer nobody's request, and this is one indexed hit.
        List<MediaRequestEntity> candidates = requestRepo.findPendingForRecordWithVoters(recordId).stream()
                .filter(r -> r.getKind() == MediaRequestKind.NEW_FILES)
                .toList();
        if (candidates.isEmpty()) {
            return 0;
        }

        List<MediaFileEntity> files = mediaFileRepo.findByRecord_Id(recordId);
        if (files.isEmpty()) {
            return 0;
        }
        Map<Integer, Set<Integer>> owned = ownedEpisodes(files);
        Set<Integer> seasonsWithFiles = owned.keySet();

        int fulfilled = 0;
        for (MediaRequestEntity request : candidates) {
            MediaRequestScope scope = request.scope();
            if (!satisfied(scope, recordId, owned, seasonsWithFiles)) {
                continue;
            }
            requestService.fulfill(request.getId(), null, ACTOR);
            fulfilled++;
            log.info("Auto-fulfilled media request id={} recordId={} scope={}",
                    request.getId(), recordId, scope.label());
        }
        return fulfilled;
    }

    private boolean satisfied(MediaRequestScope scope, Long recordId,
                              Map<Integer, Set<Integer>> owned, Set<Integer> seasonsWithFiles) {
        // "Nothing of this title is here" — offered only when the record had no files at all, so
        // the first file answers it. Anything stricter would never close for a still-airing show.
        if (scope.isWholeTitle()) {
            return true;   // callers only reach here when the record has at least one file
        }
        if (scope.isEpisode()) {
            return owned.getOrDefault(scope.season(), Set.of()).contains(scope.episode());
        }

        // A season ask is "fill the gaps in this season", so it needs every episode that has
        // actually aired. Unaired episodes are excluded or a currently-running season could
        // never be satisfied; if TMDB knows no aired episodes at all, having any file for the
        // season is the best evidence available.
        Set<Integer> expected = airedEpisodeNumbers(recordId, scope.season());
        if (expected.isEmpty()) {
            return seasonsWithFiles.contains(scope.season());
        }
        return owned.getOrDefault(scope.season(), Set.of()).containsAll(expected);
    }

    /** season -> episode numbers present on disk. Files carrying only a season land as an empty set. */
    private static Map<Integer, Set<Integer>> ownedEpisodes(List<MediaFileEntity> files) {
        Map<Integer, Set<Integer>> owned = new HashMap<>();
        for (MediaFileEntity f : files) {
            Integer season = f.getTmdbSeasonNumber();
            if (season == null) {
                continue;
            }
            Set<Integer> episodes = owned.computeIfAbsent(season, k -> new HashSet<>());
            if (f.getTmdbEpisodeNumber() != null) {
                episodes.add(f.getTmdbEpisodeNumber());
            }
        }
        return owned;
    }

    /** Episode numbers TMDB lists for this season with an air date that has passed. */
    private Set<Integer> airedEpisodeNumbers(Long recordId, int seasonNumber) {
        RecordEntity record = recordRepo.findById(recordId).orElse(null);
        if (record == null || !(record.getTmdb() instanceof TvSeriesTmdbEntity tv) || tv.getSeasons() == null) {
            return Set.of();
        }
        LocalDate today = LocalDate.now();
        Set<Integer> aired = new HashSet<>();
        for (SeasonEntity season : tv.getSeasons()) {
            if (season == null || season.getSeasonNumber() != seasonNumber || season.getEpisodes() == null) {
                continue;
            }
            for (EpisodeEntity episode : season.getEpisodes()) {
                if (episode != null && hasAired(episode.getAirDate(), today)) {
                    aired.add(episode.getEpisodeNumber());
                }
            }
        }
        return aired;
    }

    /**
     * TMDB air dates are ISO strings, and blank or unparseable means unscheduled — treated as NOT
     * aired, because requiring an episode nobody can have only delays a fulfil, while excusing one
     * that does exist would close a request on a season that still has real gaps.
     */
    private static boolean hasAired(String airDate, LocalDate today) {
        if (airDate == null || airDate.isBlank()) {
            return false;
        }
        try {
            return !LocalDate.parse(airDate.trim()).isAfter(today);
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
