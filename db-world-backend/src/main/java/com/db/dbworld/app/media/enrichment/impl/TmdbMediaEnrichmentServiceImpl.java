package com.db.dbworld.app.media.enrichment.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService;
import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.core.processor.ProcessExecutor;
import com.db.dbworld.core.processor.StreamProcessor;
import com.db.dbworld.app.media.ingestion.tracking.ProgressSnapshot;
import com.db.dbworld.app.media.ingestion.tracking.TrackingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
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
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("(?i)[._ -]S(\\d{2})E(\\d{2})(?:[._ -]|$)");

    private final RecordRepository recordRepository;
    private final ProcessExecutor  processExecutor;
    private final TrackingService  trackingService;

    /**
     * Self-reference through the Spring proxy.
     * Required so that {@link #enrich} can call {@link #resolveNamingInfo}
     * through the proxy and trigger the {@code @Transactional} session —
     * direct internal calls (self-invocation) bypass the proxy and skip the transaction,
     * causing {@code LazyInitializationException} on LAZY collections like {@code seasons}.
     */
    @Lazy
    @Autowired
    private TmdbMediaEnrichmentService self;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    // ──────────────────────────────────────────────────────────────────────────

    @Override
    public Path enrich(Path inputFile, Long recordId, Integer season, Integer episode,
                       TrackFilter trackFilter, String jobId) {
        // Call through self-proxy so @Transactional on resolveNamingInfo opens a real session.
        // The transaction is closed when resolveNamingInfo returns (short-lived, read-only).
        // FFmpeg then runs outside any DB transaction.
        Optional<MediaNamingInfo> namingInfo = self.resolveNamingInfo(recordId, season, episode, jobId);
        if (namingInfo.isEmpty()) {
            log.debug("[{}] No recordId — skipping TMDB enrichment", jobId);
            return inputFile;
        }
        return doEnrich(inputFile, namingInfo.get(), season, episode, trackFilter, jobId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MediaNamingInfo> resolveNamingInfo(Long recordId, Integer season, Integer episode, String jobId) {
        if (recordId == null) {
            return Optional.empty();
        }

        return recordRepository.findByIdWithTmdb(recordId)
                .map(record -> {
                    TmdbEntity tmdb = record.getTmdb();
                    if (tmdb == null) {
                        log.debug("[{}] No TMDB data — skipping enrichment", jobId);
                        return null;
                    }

                    String title = tmdb.getTitle() != null && !tmdb.getTitle().isBlank()
                            ? tmdb.getTitle()
                            : record.getName();
                    String releaseYear = extractReleaseYear(tmdb);
                    String posterPath = tmdb.getPosterPath();
                    String seriesTitle = null;
                    String episodeName = null;
                    boolean wantsEpisodeNaming = record.getType() == RecordType.TV_SERIES
                            && season != null && episode != null;

                    if (tmdb instanceof TvSeriesTmdbEntity tvSeries && season != null && episode != null) {
                        EpisodeInfo ep = resolveEpisode(tvSeries, season, episode);
                        seriesTitle = firstNonBlank(tvSeries.getTitle(), record.getName(), title);
                        if (ep != null) {
                            episodeName = ep.name();
                            title = ep.name();
                            if (ep.stillPath() != null && !ep.stillPath().isBlank()) {
                                posterPath = ep.stillPath();
                            }
                        }
                    }

                    if (wantsEpisodeNaming && (seriesTitle == null || seriesTitle.isBlank())) {
                        seriesTitle = firstNonBlank(record.getName(), title);
                    }

                    String overview = tmdb.getOverview();
                    return new MediaNamingInfo(title, releaseYear, seriesTitle, episodeName, posterPath, overview);
                })
                .filter(info -> info != null);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Core enrichment
    // ──────────────────────────────────────────────────────────────────────────

    private Path doEnrich(Path inputFile, MediaNamingInfo namingInfo, Integer season, Integer episode,
                          TrackFilter filter, String jobId) {
        try {
            Path posterFile = downloadImage(namingInfo.posterPath(), jobId);
            Path outputFile = resolveOutputPath(inputFile, namingInfo.title(), namingInfo.seriesTitle(), season, episode, namingInfo.episodeName());

            // ── ONE FFmpeg pass ───────────────────────────────────────────
            runFfmpegOnePass(inputFile, posterFile, outputFile, namingInfo.title(), namingInfo.overview(), filter, jobId);
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
                                  String metadataTitle, String overview, TrackFilter filter,
                                  String jobId) throws ProcessExecutionException {
        List<String> cmd = new ArrayList<>();
        cmd.add("-y");
        cmd.add("-progress");
        cmd.add("pipe:2");
        cmd.add("-nostats");
        cmd.addAll(List.of("-i", input.toAbsolutePath().toString()));

        boolean hasPoster = poster != null && Files.exists(poster);
        if (hasPoster) {
            cmd.addAll(List.of("-i", poster.toAbsolutePath().toString()));
        }

        // Clear all global metadata from input so we start clean
        cmd.addAll(List.of("-map_metadata", "-1"));

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

        // Global metadata: title, overview/description
        if (metadataTitle != null && !metadataTitle.isBlank()) {
            cmd.addAll(List.of("-metadata", "title=" + metadataTitle));
            // Set video track title to match
            cmd.addAll(List.of("-metadata:s:v:0", "title=" + metadataTitle));
        }
        if (overview != null && !overview.isBlank()) {
            // "description" works for MKV; "comment" is a common fallback for other containers
            cmd.addAll(List.of("-metadata", "description=" + overview));
            cmd.addAll(List.of("-metadata", "comment=" + overview));
        }

        cmd.add(output.toAbsolutePath().toString());

        log.info("[{}] FFmpeg one-pass: {} → {} | filter={} poster={}",
                jobId, input.getFileName(), output.getFileName(),
                hasFilter, hasPoster);

        processExecutor.executeFfmpegCommand(cmd, new FfmpegProgressProcessor(jobId), null);
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

    private Path resolveOutputPath(Path input, String metadataTitle, String seriesTitle, Integer season,
                                   Integer episode, String episodeName) {
        EpisodeRef inferredEpisode = inferSeasonEpisode(input);
        Integer resolvedSeason = season != null ? season : inferredEpisode != null ? inferredEpisode.season() : null;
        Integer resolvedEpisode = episode != null ? episode : inferredEpisode != null ? inferredEpisode.episode() : null;
        String ext  = extension(input.getFileName().toString());
        String base;
        if (resolvedSeason != null && resolvedEpisode != null) {
            String fallbackSeriesTitle = firstNonBlank(seriesTitle, inferSeriesTitleFromInput(input), metadataTitle);
            String safeTitle  = safeName(fallbackSeriesTitle != null ? fallbackSeriesTitle : stripExt(input.getFileName().toString()));
            String safeEpName = episodeName != null ? "." + safeName(episodeName) : "";
            base = String.format("%s.S%02dE%02d%s.%s", safeTitle, resolvedSeason, resolvedEpisode, safeEpName, ext);
        } else if (metadataTitle != null && !metadataTitle.isBlank()) {
            base = safeName(metadataTitle) + "." + ext;
        } else {
            base = stripExt(input.getFileName().toString()) + "." + ext;
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

    private String extractReleaseYear(TmdbEntity tmdb) {
        if (tmdb instanceof MovieTmdbEntity movie && movie.getReleaseDate() != null && movie.getReleaseDate().length() >= 4) {
            return movie.getReleaseDate().substring(0, 4);
        }
        if (tmdb instanceof TvSeriesTmdbEntity series && series.getFirstAirDate() != null && series.getFirstAirDate().length() >= 4) {
            return series.getFirstAirDate().substring(0, 4);
        }
        return null;
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String inferSeriesTitleFromInput(Path input) {
        String fileName = stripExt(input.getFileName().toString());
        return fileName
                .replaceAll("(?i)[. _-]S\\d{2}E\\d{2}.*$", "")
                .replace('.', ' ')
                .trim();
    }

    private EpisodeRef inferSeasonEpisode(Path input) {
        Matcher matcher = SEASON_EPISODE_PATTERN.matcher(input.getFileName().toString());
        if (!matcher.find()) {
            return null;
        }
        try {
            return new EpisodeRef(Integer.parseInt(matcher.group(1)), Integer.parseInt(matcher.group(2)));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private record EpisodeRef(int season, int episode) {}

    private class FfmpegProgressProcessor extends StreamProcessor {
        private static final Pattern DURATION_PATTERN = Pattern.compile("Duration: (\\d{2}):(\\d{2}):(\\d{2})\\.(\\d{2})");

        private final String jobId;
        private long totalDurationMs;

        private FfmpegProgressProcessor(String jobId) {
            this.jobId = jobId;
        }

        @Override
        protected void processLine(String line, boolean isErrorStream) {
            if (line == null || line.isBlank()) {
                return;
            }

            Matcher duration = DURATION_PATTERN.matcher(line);
            if (duration.find()) {
                totalDurationMs = parseClockToMillis(duration.group(1), duration.group(2), duration.group(3), duration.group(4));
                return;
            }

            if (line.startsWith("out_time_ms=")) {
                long processedMs = parseLong(line.substring("out_time_ms=".length()));
                if (processedMs > 0 && totalDurationMs > 0) {
                    long etaSeconds = Math.max(0L, (totalDurationMs - processedMs) / 1000L);
                    trackingService.updateProgress(jobId, new ProgressSnapshot(processedMs, totalDurationMs, 0.0, etaSeconds));
                }
                return;
            }

            if (line.startsWith("progress=")) {
                trackingService.getLogCollector(jobId).info("FFMPEG", line.trim());
                return;
            }

            trackingService.getLogCollector(jobId).info("FFMPEG", line.trim());
        }

        private long parseClockToMillis(String hh, String mm, String ss, String cs) {
            return (Long.parseLong(hh) * 3600_000L)
                    + (Long.parseLong(mm) * 60_000L)
                    + (Long.parseLong(ss) * 1000L)
                    + (Long.parseLong(cs) * 10L);
        }

        private long parseLong(String value) {
            try {
                return Long.parseLong(value.trim()) / 1000L;
            } catch (Exception e) {
                return 0L;
            }
        }
    }
}
