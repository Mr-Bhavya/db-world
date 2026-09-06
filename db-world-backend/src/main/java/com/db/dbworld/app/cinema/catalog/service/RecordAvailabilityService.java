package com.db.dbworld.app.cinema.catalog.service;

import com.db.dbworld.app.cinema.catalog.dto.RecordAvailabilityDto;
import com.db.dbworld.app.cinema.catalog.dto.RecordAvailabilityDto.SeasonAvailability;
import com.db.dbworld.app.cinema.catalog.entities.RecordEntity;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.season.entity.SeasonEntity;
import com.db.dbworld.app.cinema.tmdb.season.repository.SeasonRepository;
import com.db.dbworld.app.media.info.repository.MediaFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Builds the public availability rollup for a record.
 *
 * <p>Separate from {@code CatalogServiceImpl} because more than one caller wants the
 * answer: the record page gets it on {@code RecordDto}, and the crawler-facing
 * {@code SeoRenderController} can state it too — availability is genuinely first-party
 * information that TMDB does not have, which is exactly the kind of content the record
 * pages were criticised for lacking.
 */
@Service
@Log4j2
@RequiredArgsConstructor
public class RecordAvailabilityService {

    private final MediaFileRepository mediaFileRepository;
    private final SeasonRepository seasonRepository;

    /**
     * @param record must be non-null and already loaded with its TMDB relation
     * @return never null; a record with nothing held reports {@code available = false}
     */
    public RecordAvailabilityDto of(RecordEntity record) {
        if (record == null || record.getId() == null) {
            return RecordAvailabilityDto.forMovie(false);
        }

        List<Object[]> pairs = mediaFileRepository.findSeasonEpisodePairsByRecordId(record.getId());
        boolean anyFiles = !pairs.isEmpty();

        if (record.getType() != RecordType.TV_SERIES) {
            return RecordAvailabilityDto.forMovie(anyFiles);
        }

        // DISTINCT episodes per season. One episode routinely has several quality
        // variants, and counting rows would report "14 of 12" on a 12-episode season.
        Map<Integer, Set<Integer>> heldBySeason = new HashMap<>();
        for (Object[] pair : pairs) {
            Integer season = (Integer) pair[0];
            Integer episode = (Integer) pair[1];
            // Null means the ingestion pipeline never mapped this file to an episode.
            // Not season 0 — that is Specials, a real season.
            if (season == null || episode == null) continue;
            heldBySeason.computeIfAbsent(season, k -> new HashSet<>()).add(episode);
        }

        List<SeasonAvailability> seasons = buildSeasons(record, heldBySeason);

        int have = seasons.stream().mapToInt(SeasonAvailability::have).sum();
        int total = seasons.stream().mapToInt(SeasonAvailability::total).sum();

        // `anyFiles` rather than `have > 0`: a series whose files carry no episode
        // mapping still has something playable, and reporting it unavailable would
        // offer a request for a title already in the library.
        return new RecordAvailabilityDto(anyFiles, have, total, seasons);
    }

    /**
     * One entry per season TMDB knows about, plus any season we hold that it does not.
     *
     * <p>Driven by TMDB rather than by the files, so a season with nothing held still
     * appears — "Season 3: 0 of 10" is the whole point, and iterating the files would
     * omit exactly the seasons worth requesting.
     */
    private List<SeasonAvailability> buildSeasons(RecordEntity record,
                                                  Map<Integer, Set<Integer>> heldBySeason) {
        List<SeasonAvailability> out = new ArrayList<>();
        Set<Integer> seen = new HashSet<>();

        Long tmdbId = record.getTmdb() == null ? null : record.getTmdb().getId();
        if (tmdbId != null) {
            for (SeasonEntity season : seasonRepository.findWithEpisodesByTvShowId(tmdbId)) {
                int number = season.getSeasonNumber();
                // episodeCount is TMDB's own figure; fall back to the episodes actually
                // ingested for that season, which is better than advertising "of 0".
                int total = season.getEpisodeCount() != null
                        ? season.getEpisodeCount()
                        : (season.getEpisodes() == null ? 0 : season.getEpisodes().size());
                int held = heldBySeason.getOrDefault(number, Set.of()).size();
                out.add(new SeasonAvailability(number, held, total));
                seen.add(number);
            }
        }

        // A season we hold files for that TMDB does not list — a mis-tagged ingest, or
        // TMDB reorganising a show. Reported with total = have so it never renders as
        // "4 of 0", and so the episodes are not silently dropped from the count.
        heldBySeason.forEach((number, episodes) -> {
            if (seen.contains(number)) return;
            log.debug("Record {} holds season {} that TMDB {} does not list",
                    record.getId(), number, tmdbId);
            out.add(new SeasonAvailability(number, episodes.size(), episodes.size()));
        });

        out.sort(Comparator.comparingInt(SeasonAvailability::season));
        return out;
    }
}
