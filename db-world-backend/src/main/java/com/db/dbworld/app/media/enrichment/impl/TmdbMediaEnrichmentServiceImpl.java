package com.db.dbworld.app.media.enrichment.impl;

import com.db.dbworld.app.cinema.catalog.repository.RecordRepository;
import com.db.dbworld.app.cinema.enums.RecordType;
import com.db.dbworld.app.cinema.tmdb.entities.MovieTmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TmdbEntity;
import com.db.dbworld.app.cinema.tmdb.entities.TvSeriesTmdbEntity;
import com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService;
import com.db.dbworld.app.media.enrichment.TrackFilter;
import com.db.dbworld.app.stream.tag.MediaTagResolver;
import com.db.dbworld.app.stream.tag.TrackTitleFormatter;
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
import java.util.Locale;
import java.util.Map;
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
        log.debug("[{}] enrich input={} recordId={} season={} episode={} hasFilter={}",
                jobId, inputFile != null ? inputFile.getFileName() : null,
                recordId, season, episode, trackFilter != null && trackFilter.hasAnyFilter());
        // Call through self-proxy so @Transactional on resolveNamingInfo opens a real session.
        // The transaction is closed when resolveNamingInfo returns (short-lived, read-only).
        // FFmpeg then runs outside any DB transaction.
        Optional<MediaNamingInfo> namingInfo = self.resolveNamingInfo(recordId, season, episode, jobId);
        if (namingInfo.isEmpty()) {
            log.info("[{}] No naming info resolved (recordId={}) — skipping TMDB enrichment", jobId, recordId);
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
            String globalTitle = buildGlobalTitle(namingInfo, season, episode);
            runFfmpegOnePass(inputFile, posterFile, outputFile, globalTitle, namingInfo.overview(), filter, jobId);
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
    // Per-track metadata helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Appends per-audio-track language and disposition metadata using
     * index-based output stream specifiers (e.g. {@code -metadata:s:a:0}).
     *
     * Index-based specifiers are the only form reliably supported by FFmpeg for
     * -metadata:s: on OUTPUT streams; the m:language:X form is an INPUT-side
     * selector and does not work on the output side in most FFmpeg builds.
     *
     * The output audio stream order mirrors the -map order:
     * for each language in keepAudioLanguages, audioStreamCounts[lang] streams
     * are included consecutively (e.g. 2 Hindi tracks, then 1 English track).
     */
    private void applyAudioTrackMetadata(List<String> cmd, TrackFilter filter) {
        if (filter == null) return;

        boolean hasLangFilter = filter.getKeepAudioLanguages() != null
                && !filter.getKeepAudioLanguages().isEmpty();

        if (!hasLangFilter) {
            // No language filtering — set titles for all audio tracks in source order
            List<TrackFilter.TrackInfo> all = filter.getAllAudioTracks();
            if (all == null || all.isEmpty()) return;
            for (int idx = 0; idx < all.size(); idx++) {
                String title = buildAudioTitle(all.get(idx));
                if (!title.isBlank()) {
                    cmd.addAll(List.of("-metadata:s:a:" + idx, "title=" + title));
                }
            }
            return;
        }

        List<String> langs  = filter.getKeepAudioLanguages();
        Map<String, Integer> counts     = filter.getAudioStreamCounts();
        Map<String, List<TrackFilter.TrackInfo>> infosByLang = filter.getAudioTracksByLang();

        String defaultLang = filter.getDefaultAudioLanguage();
        if (defaultLang == null || !langs.contains(defaultLang)) {
            if (defaultLang != null) {
                log.warn("defaultAudioLanguage '{}' not found in keepAudioLanguages {}; using first as default",
                        defaultLang, langs);
            }
            defaultLang = langs.get(0);
        }

        int     idx           = 0;
        boolean defaultMarked = false;
        for (String lang : langs) {
            int count = counts != null ? counts.getOrDefault(lang, 1) : 1;
            List<TrackFilter.TrackInfo> infos = infosByLang != null ? infosByLang.get(lang) : null;
            boolean isDefaultLang = lang.equals(defaultLang);
            for (int i = 0; i < count; i++) {
                cmd.addAll(List.of("-metadata:s:a:" + idx, "language=" + lang));
                TrackFilter.TrackInfo info = (infos != null && i < infos.size()) ? infos.get(i) : null;
                String title = info != null ? buildAudioTitle(info) : MediaTagResolver.resolveLanguage(lang);
                if (!title.isBlank()) {
                    cmd.addAll(List.of("-metadata:s:a:" + idx, "title=" + title));
                }
                boolean makeDefault = isDefaultLang && !defaultMarked;
                cmd.addAll(List.of("-disposition:a:" + idx, makeDefault ? "default" : "0"));
                if (makeDefault) defaultMarked = true;
                idx++;
            }
        }
    }

    /**
     * Appends per-subtitle-track language, disposition, and title metadata
     * using index-based output stream specifiers (e.g. {@code -metadata:s:s:0}).
     */
    private void applySubtitleTrackMetadata(List<String> cmd, TrackFilter filter) {
        if (filter == null) return;
        // empty keepSubtitleLanguages = remove all — no output streams to annotate
        if (filter.getKeepSubtitleLanguages() != null && filter.getKeepSubtitleLanguages().isEmpty()) return;

        boolean hasLangFilter = filter.getKeepSubtitleLanguages() != null;

        if (!hasLangFilter) {
            // null = keep all subtitles in source order — set titles only
            List<TrackFilter.TrackInfo> all = filter.getAllSubTracks();
            if (all == null || all.isEmpty()) return;
            for (int idx = 0; idx < all.size(); idx++) {
                String title = buildSubTitle(all.get(idx));
                if (!title.isBlank()) {
                    cmd.addAll(List.of("-metadata:s:s:" + idx, "title=" + title));
                }
            }
            return;
        }

        List<String> subLangs = filter.getKeepSubtitleLanguages();
        Map<String, Integer> counts     = filter.getSubStreamCounts();
        Map<String, List<TrackFilter.TrackInfo>> infosByLang = filter.getSubTracksByLang();

        int idx = 0;
        for (String lang : subLangs) {
            int count = counts != null ? counts.getOrDefault(lang, 1) : 1;
            List<TrackFilter.TrackInfo> infos = infosByLang != null ? infosByLang.get(lang) : null;
            for (int i = 0; i < count; i++) {
                cmd.addAll(List.of("-metadata:s:s:" + idx, "language=" + lang));
                TrackFilter.TrackInfo info = (infos != null && i < infos.size()) ? infos.get(i) : null;
                String title = info != null ? buildSubTitle(info) : MediaTagResolver.resolveLanguage(lang);
                if (!title.isBlank()) {
                    cmd.addAll(List.of("-metadata:s:s:" + idx, "title=" + title));
                }
                if (filter.isNoDefaultSubtitle()) {
                    cmd.addAll(List.of("-disposition:s:" + idx, "0"));
                }
                idx++;
            }
        }
    }

    private static String buildAudioTitle(TrackFilter.TrackInfo info) {
        return TrackTitleFormatter.formatAudioTitle(info);
    }

    private static String buildSubTitle(TrackFilter.TrackInfo info) {
        return TrackTitleFormatter.formatSubTitle(info);
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
        String inputName     = input.getFileName().toString().toLowerCase(Locale.ROOT);
        boolean isMkv        = inputName.endsWith(".mkv");
        boolean hasPoster    = poster != null && Files.exists(poster);
        boolean posterAsInput  = hasPoster && !isMkv;
        boolean posterAsAttach = hasPoster && isMkv;

        List<String> cmd = new ArrayList<>();
        cmd.add("-y");
        cmd.add("-progress");
        cmd.add("pipe:2");
        cmd.add("-nostats");
        cmd.addAll(List.of("-i", input.toAbsolutePath().toString()));

        if (posterAsInput) {
            cmd.addAll(List.of("-i", poster.toAbsolutePath().toString()));
        }

        // Drop ALL source CONTAINER (global) metadata — this strips release-group /
        // site tags (URLs, comments, "encoded by", etc.) that some rips embed.
        // Per-stream metadata (track titles, languages) is NOT affected by this and
        // survives via -c copy; the global title/description we want are re-added below.
        cmd.addAll(List.of("-map_metadata", "-1"));

        boolean hasFilter = filter != null && filter.hasAnyFilter();

        // ── Stream mapping ────────────────────────────────────────────────────
        if (!hasFilter) {
            // Case A / B: simple copy
            cmd.addAll(List.of("-map", "0"));
            if (posterAsInput) cmd.addAll(List.of("-map", "1"));
        } else {
            // Case C: selective mapping — start with all, subtract unwanted
            cmd.addAll(List.of("-map", "0"));

            if (filter.isKeepFirstVideoOnly()) {
                cmd.addAll(List.of("-map", "-0:v"));
                cmd.addAll(List.of("-map", "0:v:0"));
            }

            // Audio filtering
            if (filter.getKeepAudioLanguages() != null && !filter.getKeepAudioLanguages().isEmpty()) {
                cmd.addAll(List.of("-map", "-0:a"));
                for (String lang : filter.getKeepAudioLanguages()) {
                    cmd.addAll(List.of("-map", "0:a:m:language:" + lang + "?"));
                }
            }

            // Subtitle filtering — keepSubtitleLanguages takes precedence over removeAllSubtitles
            if (filter.getKeepSubtitleLanguages() != null) {
                cmd.addAll(List.of("-map", "-0:s")); // remove all first
                for (String lang : filter.getKeepSubtitleLanguages()) {
                    // empty list means remove all — no re-add loop runs
                    cmd.addAll(List.of("-map", "0:s:m:language:" + lang + "?"));
                }
            } else if (filter.isRemoveAllSubtitles()) {
                cmd.addAll(List.of("-map", "-0:s"));
            }

            if (posterAsInput) cmd.addAll(List.of("-map", "1"));
        }

        cmd.addAll(List.of("-c", "copy"));

        if (posterAsInput) {
            cmd.addAll(List.of("-disposition:v:1", "attached_pic"));
            cmd.addAll(List.of("-metadata:s:v:1", "mimetype=image/jpeg"));
        }

        // ── Per-track metadata ────────────────────────────────────────────────
        applyAudioTrackMetadata(cmd, filter);
        applySubtitleTrackMetadata(cmd, filter);

        // ── Video stream title: codec / resolution / bit depth / HDR / bitrate ──
        // (Not the movie name — that goes in the global title below.)
        if (filter != null && filter.getVideoTrack() != null) {
            String videoTitle = TrackTitleFormatter.formatVideoTitle(filter.getVideoTrack());
            if (!videoTitle.isBlank()) {
                cmd.addAll(List.of("-metadata:s:v:0", "title=" + videoTitle));
            }
        }

        // ── Global metadata ───────────────────────────────────────────────────
        if (metadataTitle != null && !metadataTitle.isBlank()) {
            cmd.addAll(List.of("-metadata", "title=" + metadataTitle));
        }
        if (overview != null && !overview.isBlank()) {
            cmd.addAll(List.of("-metadata", "description=" + overview));
            cmd.addAll(List.of("-metadata", "comment=" + overview));
        }

        // ── MKV cover art as attachment ───────────────────────────────────────
        if (posterAsAttach) {
            String posterName = poster.getFileName().toString();
            String mime       = posterName.endsWith(".png") ? "image/png" : "image/jpeg";
            String coverName  = posterName.endsWith(".png") ? "cover.png" : "cover.jpg";
            cmd.addAll(List.of("-attach", poster.toAbsolutePath().toString()));
            cmd.addAll(List.of("-metadata:s:t:0", "mimetype=" + mime));
            cmd.addAll(List.of("-metadata:s:t:0", "filename=" + coverName));
        }

        cmd.add(output.toAbsolutePath().toString());

        log.info("[{}] FFmpeg one-pass: {} → {} | filter={} poster={}",
                jobId, input.getFileName(), output.getFileName(), hasFilter, hasPoster);

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

    /**
     * Builds the global {@code title} metadata tag value.
     *
     * For movies:    "{Title}"
     * For TV series: "{SeriesName} - Season X Episode Y \u2013 {EpisodeName}"
     *                (en-dash before episode name; episode name is optional)
     */
    private String buildGlobalTitle(MediaNamingInfo info, Integer season, Integer episode) {
        if (info.seriesTitle() != null && !info.seriesTitle().isBlank()
                && season != null && episode != null) {
            StringBuilder sb = new StringBuilder(info.seriesTitle())
                    .append(" - Season ").append(season)
                    .append(" Episode ").append(episode);
            if (info.episodeName() != null && !info.episodeName().isBlank()) {
                sb.append(" \u2013 ").append(info.episodeName()); // en-dash (–)
            }
            return sb.toString();
        }
        return info.title();
    }

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

            // Parse total duration for progress bar (never logged)
            Matcher duration = DURATION_PATTERN.matcher(line);
            if (duration.find()) {
                totalDurationMs = parseClockToMillis(duration.group(1), duration.group(2), duration.group(3), duration.group(4));
                return;
            }

            // Update UI progress bar from per-frame timestamps (never logged).
            // Use out_time_us ONLY — it is always microseconds. out_time_ms is a misnomer:
            // its value is microseconds in most builds but true milliseconds in others, so
            // trusting it makes the bar/ETA either correct or 1000x off depending on the build.
            if (line.startsWith("out_time_us=")) {
                long processedMs = microsToMillis(line.substring("out_time_us=".length()));
                if (processedMs > 0 && totalDurationMs > 0) {
                    long etaSeconds = Math.max(0L, (totalDurationMs - processedMs) / 1000L);
                    trackingService.updateProgress(jobId, new ProgressSnapshot(processedMs, totalDurationMs, 0.0, etaSeconds, "processing"));
                }
                return;
            }

            // Drop high-frequency progress key=value pairs (emitted every ~500ms)
            if (isProgressKeyValue(line)) return;

            // Drop FFmpeg version/build/library header block
            if (isVerboseHeader(line)) return;

            // Drop all indented stream/metadata detail lines
            if (line.startsWith("  ") || line.startsWith("\t")) return;

            // Drop top-level container/stream description headers
            if (line.startsWith("Input #") || line.startsWith("Output #")
                    || line.startsWith("Stream mapping") || line.startsWith("Stream #")) return;

            // Everything else is meaningful: final stats line, codec/muxer messages, warnings
            trackingService.getLogCollector(jobId).info("FFMPEG", line.trim());
        }

        private static boolean isProgressKeyValue(String line) {
            return line.startsWith("bitrate=") || line.startsWith("total_size=")
                    || line.startsWith("out_time_us=") || line.startsWith("out_time_ms=")
                    || line.startsWith("out_time=") || line.startsWith("dup_frames=")
                    || line.startsWith("drop_frames=") || line.startsWith("speed=")
                    || line.startsWith("progress=") || line.startsWith("frame=")
                    || line.startsWith("fps=") || line.startsWith("stream_");
        }

        private static boolean isVerboseHeader(String line) {
            return line.startsWith("ffmpeg version") || line.startsWith("built with")
                    || line.startsWith("configuration:") || line.startsWith("Press [q]")
                    || line.matches("lib(avutil|avcodec|avformat|avdevice|avfilter|swscale|swresample|postproc).*");
        }

        private long parseClockToMillis(String hh, String mm, String ss, String cs) {
            return (Long.parseLong(hh) * 3600_000L)
                    + (Long.parseLong(mm) * 60_000L)
                    + (Long.parseLong(ss) * 1000L)
                    + (Long.parseLong(cs) * 10L);
        }

        /** ffmpeg out_time_us is microseconds; convert to milliseconds. */
        private long microsToMillis(String micros) {
            try {
                return Long.parseLong(micros.trim()) / 1000L;
            } catch (Exception e) {
                return 0L;
            }
        }
    }
}
