package com.db.dbworld.app.media.enrichment.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService;
import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.core.processor.ProcessExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * One-pass FFmpeg enrichment.
 *
 * A single FFmpeg invocation handles all of:
 *  - Track filtering (audio language selection, subtitle removal, video stream selection)
 *  - Cover-art embedding (TMDB poster / episode still)
 *  - Metadata title tag
 *  - File renaming (TV: {Title}.S{SS}E{EE}.{EpisodeName}.{ext})
 *
 * FFmpeg stream mapping strategy:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ No filter + no poster  → -map 0 -c copy                                │
 * │ No filter + poster     → -map 0 -map 1 -c copy -disposition:v:1 ...   │
 * │ Filter + no poster     → selective -map 0 streams + negative maps      │
 * │ Filter + poster        → selective maps + -map 1 + disposition         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * TMDB image CDN: https://image.tmdb.org/t/p/original{posterPath}
 */
@Log4j2
@Service
@RequiredArgsConstructor
public class TmdbMediaEnrichmentServiceImpl implements TmdbMediaEnrichmentService {

    private static final String TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";

    private final RecordRepository recordRepository;
    private final ProcessExecutor  processExecutor;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    // ──────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Path enrich(Path inputFile, Long recordId, Integer season, Integer episode,
                       TrackFilter trackFilter, String jobId) {
        if (recordId == null) {
            log.debug("[{}] No recordId — skipping TMDB enrichment", jobId);
            return inputFile;
        }

        return recordRepository.findById(recordId)
                .map(record -> {
                    TmdbEntity tmdb = record.getTmdb();
                    if (tmdb == null) {
                        log.debug("[{}] No TMDB data — skipping enrichment", jobId);
                        return inputFile;
                    }
                    return doEnrich(inputFile, tmdb, season, episode, trackFilter, jobId);
                })
                .orElseGet(() -> {
                    log.warn("[{}] RecordEntity {} not found — skipping enrichment", jobId, recordId);
                    return inputFile;
                });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Core enrichment
    // ──────────────────────────────────────────────────────────────────────────

    private Path doEnrich(Path inputFile, TmdbEntity tmdb, Integer season, Integer episode,
                          TrackFilter filter, String jobId) {
        try {
            String posterPath    = tmdb.getPosterPath();
            String metadataTitle = tmdb.getTitle();
            String seriesTitle   = null;
            String episodeName   = null;

            if (tmdb instanceof TvSeriesTmdbEntity tvSeries && season != null && episode != null) {
                EpisodeInfo ep = resolveEpisode(tvSeries, season, episode);
                if (ep != null) {
                    episodeName   = ep.name();
                    seriesTitle   = tvSeries.getTitle();
                    metadataTitle = ep.name();
                    // Episode still has higher visual priority than the series poster
                    if (ep.stillPath() != null && !ep.stillPath().isBlank()) {
                        posterPath = ep.stillPath();
                    }
                }
            }

            Path posterFile = downloadImage(posterPath, jobId);
            Path outputFile = resolveOutputPath(inputFile, seriesTitle, season, episode, episodeName);

            // ── ONE FFmpeg pass ───────────────────────────────────────────
            runFfmpegOnePass(inputFile, posterFile, outputFile, metadataTitle, filter, jobId);
            // ─────────────────────────────────────────────────────────────

            if (!outputFile.equals(inputFile)) {
                Files.deleteIfExists(inputFile);
            }
            if (posterFile != null) {
                Files.deleteIfExists(posterFile);
            }

            log.info("[{}] Enrichment complete → {}", jobId, outputFile.getFileName());
            return outputFile;

        } catch (Exception e) {
            log.error("[{}] TMDB enrichment failed (non-fatal): {}", jobId, e.getMessage());
            return inputFile;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // One-pass FFmpeg command
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Builds and executes a single FFmpeg command that covers:
     *  track filtering + cover-art embedding + metadata + output renaming.
     *
     * Stream mapping rules:
     *
     *  Case A — no filter, no poster:
     *    -map 0 -c copy
     *
     *  Case B — no filter, with poster:
     *    -map 0 -map 1 -c copy -disposition:v:1 attached_pic -metadata:s:v:1 mimetype=image/jpeg
     *
     *  Case C — with filter:
     *    Start from -map 0 (all streams), then apply negative maps to drop
     *    unwanted streams.  This preserves unknown/data streams without
     *    having to enumerate every stream type explicitly.
     *
     *    -map 0                              (take everything first)
     *    [-map -0:v:0? … keep only first video via -vn + re-add?]
     *      → actually simpler: use -map 0 then strip with negative maps:
     *    [-map -0:s]                         (remove all subtitles)
     *    for each audio to remove:
     *    [-map -0:a:m:language:X]            (remove audio with language X)
     *
     *  Poster (if present) is always appended after the input maps.
     *
     * Note: "keepFirstVideoOnly" uses -vf/-sn approach only for cases where
     * there are literally multiple video angle tracks; in practice standard
     * rips have exactly one video stream so the flag is a no-op for them.
     */
    private void runFfmpegOnePass(Path input, Path poster, Path output,
                                  String metadataTitle, TrackFilter filter,
                                  String jobId) throws ProcessExecutionException {
        List<String> cmd = new ArrayList<>();
        cmd.add("-y");
        cmd.addAll(List.of("-i", input.toAbsolutePath().toString()));

        boolean hasPoster = poster != null && Files.exists(poster);
        if (hasPoster) {
            cmd.addAll(List.of("-i", poster.toAbsolutePath().toString()));
        }

        boolean hasFilter = filter != null && filter.hasAnyFilter();

        if (!hasFilter) {
            // ── Case A / B: simple copy ────────────────────────────────────
            cmd.addAll(List.of("-map", "0"));
            if (hasPoster) {
                cmd.addAll(List.of("-map", "1"));
            }
        } else {
            // ── Case C: selective stream mapping ──────────────────────────
            // Start with all streams from input, then subtract unwanted ones
            cmd.addAll(List.of("-map", "0"));

            if (filter.isKeepFirstVideoOnly()) {
                // Remove all video streams beyond the first.
                // -map -0:v:1 removes v:1, -0:v:2 removes v:2 … but we
                // don't know how many there are.  Use -vn then re-map v:0.
                cmd.addAll(List.of("-map", "-0:v"));      // remove ALL video
                cmd.addAll(List.of("-map", "0:v:0"));     // then re-add only first
            }

            if (filter.isRemoveAllSubtitles()) {
                cmd.addAll(List.of("-map", "-0:s"));
            }

            if (filter.getKeepAudioLanguages() != null && !filter.getKeepAudioLanguages().isEmpty()) {
                // Remove audio streams that do NOT match any of the desired languages.
                // Approach: remove all audio, then re-add only matching languages.
                cmd.addAll(List.of("-map", "-0:a"));
                for (String lang : filter.getKeepAudioLanguages()) {
                    cmd.addAll(List.of("-map", "0:a:m:language:" + lang + "?"));
                }
            }

            if (hasPoster) {
                cmd.addAll(List.of("-map", "1"));
            }
        }

        cmd.addAll(List.of("-c", "copy"));

        if (hasPoster) {
            // The poster is always the last mapped video stream.
            // v:1 is correct when input has exactly one real video stream (standard case).
            cmd.addAll(List.of("-disposition:v:1", "attached_pic"));
            cmd.addAll(List.of("-metadata:s:v:1",  "mimetype=image/jpeg"));
        }

        if (metadataTitle != null && !metadataTitle.isBlank()) {
            cmd.addAll(List.of("-metadata", "title=" + metadataTitle));
        }

        cmd.add(output.toAbsolutePath().toString());

        log.info("[{}] FFmpeg one-pass: {} → {} | filter={} poster={}",
                jobId, input.getFileName(), output.getFileName(),
                hasFilter, hasPoster);

        processExecutor.executeFfmpegCommand(cmd, null, null);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Episode resolution
    // ──────────────────────────────────────────────────────────────────────────

    private EpisodeInfo resolveEpisode(TvSeriesTmdbEntity tvSeries, int seasonNum, int episodeNum) {
        if (tvSeries.getSeasons() == null) return null;
        return tvSeries.getSeasons().stream()
                .filter(s -> s.getSeasonNumber() == seasonNum)
                .findFirst()
                .map(s -> {
                    if (s.getEpisodes() == null) return null;
                    return s.getEpisodes().stream()
                            .filter(ep -> ep.getEpisodeNumber() == episodeNum)
                            .findFirst()
                            .map(ep -> new EpisodeInfo(ep.getName(), ep.getStillPath()))
                            .orElse(null);
                })
                .orElse(null);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Poster download
    // ──────────────────────────────────────────────────────────────────────────

    private Path downloadImage(String posterPath, String jobId) {
        if (posterPath == null || posterPath.isBlank()) return null;
        try {
            String url = posterPath.startsWith("http")
                    ? posterPath : TMDB_IMAGE_BASE + posterPath;
            String ext = posterPath.endsWith(".png") ? ".png" : ".jpg";
            Path tmp = Files.createTempFile("tmdb_poster_" + jobId, ext);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .GET().build();

            HttpResponse<Path> resp = httpClient.send(req,
                    HttpResponse.BodyHandlers.ofFile(tmp));

            if (resp.statusCode() == 200) {
                log.debug("[{}] Poster downloaded: {} bytes", jobId, Files.size(tmp));
                return tmp;
            }
            log.warn("[{}] Poster HTTP {}", jobId, resp.statusCode());
            Files.deleteIfExists(tmp);
            return null;
        } catch (Exception e) {
            log.warn("[{}] Poster download failed: {}", jobId, e.getMessage());
            return null;
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Output path
    // ──────────────────────────────────────────────────────────────────────────

    private Path resolveOutputPath(Path input, String seriesTitle, Integer season,
                                   Integer episode, String episodeName) {
        String ext  = extension(input.getFileName().toString());
        String base;
        if (seriesTitle != null && season != null && episode != null) {
            String safeTitle  = safeName(seriesTitle);
            String safeEpName = episodeName != null ? "." + safeName(episodeName) : "";
            base = String.format("%s.S%02dE%02d%s.%s", safeTitle, season, episode, safeEpName, ext);
        } else {
            base = stripExt(input.getFileName().toString()) + "_enriched." + ext;
        }
        return input.getParent().resolve(base);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────────

    private String extension(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(dot + 1) : "mkv";
    }

    private String stripExt(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }

    private String safeName(String name) {
        return name.trim()
                .replaceAll("[\\\\/:*?\"<>|]", "")
                .replaceAll("\\s+", ".")
                .replaceAll("\\.{2,}", ".");
    }

    private record EpisodeInfo(String name, String stillPath) {}
}
