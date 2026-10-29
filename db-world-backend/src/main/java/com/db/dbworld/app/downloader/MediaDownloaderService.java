package com.db.dbworld.app.downloader;

import com.db.dbworld.config.AppProperties;
import com.db.dbworld.infrastructure.storage.MediaDiskGuard;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;

@Service
@Log4j2
public class MediaDownloaderService {
    static final List<String> ACTIVE = List.of("DOWNLOADING", "CONVERTING");
    private final DownloadJobRepository repository;
    private final AppProperties properties;
    private final MediaDiskGuard disk;
    private final ObjectMapper json;
    private final Path root;
    private final Map<String, Running> running = new ConcurrentHashMap<>();
    private final Set<Process> processes = ConcurrentHashMap.newKeySet();
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
    private volatile boolean stopping;
    @Value("${app.downloader.probe-timeout-seconds:75}")
    private long probeTimeoutSeconds = 75;

    public record Request(List<String> urls, String preset, String quality, boolean subtitles,
                          boolean thumbnailFile, String subtitleLanguage, String audioLanguage,
                          Double startSeconds, Double endSeconds, String videoFormat, String audioFormat, String container) {
        public Request(List<String> urls, String preset, String quality, boolean subtitles, boolean thumbnailFile,
                       String subtitleLanguage, String audioLanguage, Double startSeconds, Double endSeconds) {
            this(urls, preset, quality, subtitles, thumbnailFile, subtitleLanguage, audioLanguage, startSeconds, endSeconds, null, null, null);
        }
    }
    public record Entry(String url, String title, String thumbnail, Double duration) {}
    public record MediaTrack(String id, String extension, String codec, Integer height, Double fps,
                             Double bitrate, String language, Integer channels, Long bytes, boolean estimated, String dynamicRange) {}
    public record Preview(String title, String thumbnail, String source, Double duration,
                          List<Integer> resolutions, List<String> audioLanguages, List<String> subtitleLanguages,
                          List<Entry> entries, List<MediaTrack> videoFormats, List<MediaTrack> audioFormats) {}
    public record JobView(String id, String owner, String source, String title, String thumbnail, String preset, String quality,
                          String status, String fileName, long bytesDownloaded, long bytesTotal, double speed,
                          Long eta, Double progress, String error, Instant createdAt, Instant expiresAt, int queuePosition) {}
    record Ticket(String owner, List<String> ids, String name, Instant expiresAt) {}
    private static final class Running {
        volatile boolean cancelled;
        volatile Process process;
    }

    public MediaDownloaderService(DownloadJobRepository repository, AppProperties properties, MediaDiskGuard disk,
                                  ObjectMapper json, @Value("${app.downloader.root:}") String configuredRoot) {
        this.repository = repository;
        this.properties = properties;
        this.disk = disk;
        this.json = json;
        this.root = (configuredRoot.isBlank() ? properties.getDownloadsPath().resolve("media-downloader")
                : Path.of(configuredRoot)).toAbsolutePath().normalize();
    }

    @PostConstruct
    void recover() {
        for (DownloadJob job : repository.findByStatusInOrderByCreatedAtAsc(ACTIVE)) {
            job.setStatus("FAILED");
            job.setError("Server restarted during preparation. Retry this download.");
            job.setSpeed(0);
            job.setEta(null);
            repository.save(job);
        }
    }

    public Preview inspect(String url, boolean playlist) throws Exception {
        return inspect(url, playlist, null);
    }

    private Preview inspect(String url, boolean playlist, Running task) throws Exception {
        String inspectionId = UUID.randomUUID().toString();
        long inspectionStarted = System.nanoTime();
        String stage = "url-validation";
        log.info("Media inspection started inspection={} sourceHost={} playlist={} probeTimeoutSeconds={}",
            inspectionId, DownloadDiagnostics.sourceHost(url), playlist, probeTimeoutSeconds);
        try {
          String normalized = DownloadPolicy.validateUrl(url).toString();
          log.info("Media inspection URL validated inspection={} elapsedMs={}", inspectionId,
              Duration.ofNanos(System.nanoTime() - inspectionStarted).toMillis());
          stage = "proxy-start";
          try (DownloadEgressProxy proxy = new DownloadEgressProxy(inspectionId)) {
            stage = "command-configuration";
            List<String> command = baseCommand(normalized, proxy);
            command.remove("--no-warnings");
            command.addAll(List.of("--socket-timeout", "15", "--retries", "1", "--extractor-retries", "1"));
            command.addAll(List.of("--dump-single-json", "--skip-download", playlist ? "--flat-playlist" : "--no-playlist", "--", normalized));
            Path cookies = properties.getCookieForUrl(normalized);
            log.info("Media inspection configured inspection={} tool={} ffmpegConfigured={} cookiesConfigured={} cookiesReadable={} socketTimeoutSeconds={} retries={} extractorRetries={} proxy=public-egress-only elapsedMs={}",
                inspectionId, DownloadDiagnostics.safeText(properties.getYtDlp()), properties.getFfmpeg() != null && !properties.getFfmpeg().isBlank(),
                cookies != null, cookies != null && Files.isReadable(cookies), DownloadDiagnostics.option(command, "--socket-timeout"),
                DownloadDiagnostics.option(command, "--retries"), DownloadDiagnostics.option(command, "--extractor-retries"),
                Duration.ofNanos(System.nanoTime() - inspectionStarted).toMillis());
            stage = "extractor-process";
            String output = execute(command, null, task, true);
            stage = "metadata-parse";
            JsonNode metadata = json.readTree(output);
            List<Entry> entries = new ArrayList<>();
            for (JsonNode entry : metadata.path("entries")) {
                String entryUrl = text(entry, "webpage_url");
                if (entryUrl == null) entryUrl = text(entry, "url");
                if (entryUrl != null && !entryUrl.startsWith("http") && normalized.contains("youtu")) {
                    entryUrl = "https://www.youtube.com/watch?v=" + text(entry, "id");
                }
                if (entryUrl != null && entryUrl.startsWith("http")) {
                    entries.add(new Entry(entryUrl, text(entry, "title"), thumbnail(entry), number(entry, "duration")));
                }
            }
            TreeSet<Integer> resolutions = new TreeSet<>(Comparator.reverseOrder());
            TreeSet<String> languages = new TreeSet<>();
            for (JsonNode format : metadata.path("formats")) {
                if (format.path("height").isNumber()) resolutions.add(format.path("height").asInt());
                String language = text(format, "language");
                if (language != null) languages.add(language);
            }
            TreeSet<String> subtitles = new TreeSet<>();
            metadata.path("subtitles").properties().forEach(entry -> subtitles.add(entry.getKey()));
            metadata.path("automatic_captions").properties().forEach(entry -> subtitles.add(entry.getKey()));
                Preview preview = new Preview(text(metadata, "title"), thumbnail(metadata), text(metadata, "extractor_key"),
                    number(metadata, "duration"), List.copyOf(resolutions), List.copyOf(languages), List.copyOf(subtitles), entries,
                    tracks(metadata, true), tracks(metadata, false));
                log.info("Media inspection completed inspection={} elapsedMs={} extractor={} videoTracks={} audioTracks={} playlistItems={}",
                    inspectionId, Duration.ofNanos(System.nanoTime() - inspectionStarted).toMillis(),
                    DownloadDiagnostics.safeText(preview.source()), preview.videoFormats().size(), preview.audioFormats().size(), preview.entries().size());
                return preview;
              }
            } catch (Exception exception) {
                log.warn("Media inspection failed inspection={} stage={} elapsedMs={} exceptionType={} diagnostic={}", inspectionId, stage,
                    Duration.ofNanos(System.nanoTime() - inspectionStarted).toMillis(), exception.getClass().getSimpleName(),
                    DownloadDiagnostics.safeText(exception.getMessage()));
                throw exception;
        }
    }

    static List<MediaTrack> tracks(JsonNode metadata, boolean video) {
        List<MediaTrack> result = new ArrayList<>();
        for (JsonNode format : metadata.path("formats")) {
            String id = text(format, "format_id");
            String videoCodec = text(format, "vcodec");
            String audioCodec = text(format, "acodec");
            if (id == null || !id.matches("[A-Za-z0-9._-]{1,100}") || format.path("has_drm").asBoolean(false)) continue;
            boolean videoOnly = videoCodec != null && !videoCodec.equals("none") && "none".equals(audioCodec);
            boolean audioOnly = audioCodec != null && !audioCodec.equals("none") && "none".equals(videoCodec);
            if (video ? !videoOnly : !audioOnly) continue;
            Long bytes = format.path("filesize").isNumber() ? format.path("filesize").asLong()
                    : format.path("filesize_approx").isNumber() ? format.path("filesize_approx").asLong() : null;
            result.add(new MediaTrack(id, text(format, "ext"), video ? videoCodec : audioCodec,
                    format.path("height").isNumber() ? format.path("height").asInt() : null, number(format, "fps"),
                    number(format, video ? "vbr" : "abr"), text(format, "language"),
                    format.path("audio_channels").isNumber() ? format.path("audio_channels").asInt() : null,
                    bytes, !format.path("filesize").isNumber(), text(format, "dynamic_range")));
        }
        Collections.reverse(result);
        return result;
    }

    static void validateTracks(Preview preview, String videoId, String audioId, String container) {
        MediaTrack video = selectedTrack(preview.videoFormats(), videoId);
        MediaTrack audio = selectedTrack(preview.audioFormats(), audioId);
        if ("mp4".equals(container) || "webm".equals(container)) {
            if (video == null || audio == null) badRequest("Select both tracks before choosing MP4 or WebM.");
            boolean compatible = "mp4".equals(container)
                    ? video.codec().matches("(?i)(avc|h264|hev|hvc|av01|hevc).*") && audio.codec().matches("(?i)(mp4a|aac).*")
                    : video.codec().matches("(?i)(vp0?8|vp0?9|av01).*") && audio.codec().matches("(?i)(opus|vorbis).*");
            if (!compatible) badRequest("The selected codecs do not fit this container. Choose Auto or MKV.");
        }
    }

    private static MediaTrack selectedTrack(List<MediaTrack> tracks, String id) {
        if (id == null || id.isBlank()) return null;
        return tracks.stream().filter(track -> track.id().equals(id)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "The selected track is no longer available. Inspect the URL again."));
    }

    public List<JobView> submit(String owner, Request request) {
        validateRequest(request);
        List<String> urls = request.urls().stream().map(url -> DownloadPolicy.validateUrl(url).toString()).distinct().toList();
        synchronized (this) {
            List<DownloadJob> jobs = new ArrayList<>();
            for (String url : urls) {
                DownloadJob job = new DownloadJob();
                job.setId(UUID.randomUUID().toString());
                job.setOwner(owner);
                job.setUrl(url);
                job.setTitle("Preparing media");
                job.setPreset(request.preset());
                job.setQuality(request.quality());
                job.setVideoFormat(request.videoFormat());
                job.setAudioFormat(request.audioFormat());
                job.setContainer(request.container());
                job.setSubtitles(request.subtitles());
                job.setThumbnailFile(request.thumbnailFile());
                job.setSubtitleLanguage(request.subtitleLanguage());
                job.setAudioLanguage(request.audioLanguage());
                job.setStartSeconds(request.startSeconds());
                job.setEndSeconds(request.endSeconds());
                job.setStatus("QUEUED");
                job.setCreatedAt(Instant.now());
                jobs.add(job);
            }
            repository.saveAll(jobs);
            log.info("Downloader submitted owner={} jobs={}", owner, jobs.size());
            return jobs.stream().map(job -> view(job, 0)).toList();
        }
    }

    static void validateRequest(Request request) {
        if (request == null || request.urls() == null || request.urls().isEmpty()) badRequest("Select at least one video.");
        DownloadPolicy.formatArguments(request.preset() == null ? "" : request.preset(), request.quality(), request.videoFormat(), request.audioFormat(), request.container());
        boolean exact = (request.videoFormat() != null && !request.videoFormat().isBlank())
            || (request.audioFormat() != null && !request.audioFormat().isBlank());
        if (exact && request.urls().size() != 1) badRequest("Exact tracks apply to a single video. Use quality presets for playlists.");
        if (List.of("mp4", "webm").contains(Objects.toString(request.container(), ""))
            && (request.videoFormat() == null || request.videoFormat().isBlank() || request.audioFormat() == null || request.audioFormat().isBlank())) {
            badRequest("Select both tracks before choosing MP4 or WebM.");
        }
        for (String language : new String[]{request.subtitleLanguage(), request.audioLanguage()}) {
            if (language != null && !language.isBlank() && !language.matches("[A-Za-z0-9_-]{1,35}")) badRequest("Invalid language.");
        }
        if ((request.startSeconds() != null && (!Double.isFinite(request.startSeconds()) || request.startSeconds() < 0))
                || (request.endSeconds() != null && (!Double.isFinite(request.endSeconds()) || request.endSeconds() <= 0))
                || (request.endSeconds() != null && request.endSeconds() <= (request.startSeconds() == null ? 0 : request.startSeconds()))) {
            badRequest("End time must be after start time.");
        }
    }

    public synchronized List<JobView> list(String owner, boolean admin) {
        List<DownloadJob> jobs = admin ? repository.findAllByOrderByCreatedAtDesc() : repository.findByOwnerOrderByCreatedAtDesc(owner);
        Map<String, Integer> positions = new HashMap<>();
        Map<String, Integer> counts = new HashMap<>();
        for (DownloadJob job : jobs.reversed()) {
            if ("QUEUED".equals(job.getStatus())) positions.put(job.getId(), counts.merge(job.getOwner(), 1, Integer::sum));
        }
        return jobs.stream().map(job -> view(job, positions.getOrDefault(job.getId(), 0))).toList();
    }

    synchronized DownloadJob authorized(String id, String owner, boolean admin) {
        DownloadJob job = repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Download not found."));
        if (!admin && !job.getOwner().equals(owner)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Download not found.");
        return job;
    }

    public synchronized void cancel(String id, String actor, boolean admin) {
        DownloadJob job = authorized(id, actor, admin);
        if (!ACTIVE.contains(job.getStatus()) && !"QUEUED".equals(job.getStatus())) return;
        Running task = running.get(id);
        if (task != null) {
            task.cancelled = true;
            stop(task.process);
        }
        job.setStatus("CANCELLED");
        job.setSpeed(0);
        job.setEta(null);
        repository.save(job);
        log.info("Downloader cancelled actor={} job={} owner={}", actor, id, job.getOwner());
    }

    public synchronized void retry(String id, String actor, boolean admin) {
        DownloadJob job = authorized(id, actor, admin);
        if (!List.of("FAILED", "CANCELLED", "EXPIRED", "DELETED").contains(job.getStatus()) || running.containsKey(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Wait until this job has stopped before retrying.");
        }
        job.setStatus("QUEUED");
        job.setError(null);
        job.setProgress(null);
        job.setBytesDownloaded(0);
        job.setBytesTotal(0);
        job.setFileName(null);
        job.setCompletedAt(null);
        job.setExpiresAt(null);
        job.setCreatedAt(Instant.now());
        repository.save(job);
        log.info("Downloader retried actor={} job={}", actor, id);
    }

    public synchronized void delete(String id, String actor, boolean admin) throws IOException {
        DownloadJob job = authorized(id, actor, admin);
        cancel(id, actor, admin);
        if (running.containsKey(id)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Cancellation requested. Delete again after the worker stops.");
        removeFiles(job);
        job.setStatus("DELETED");
        job.setFileName(null);
        repository.save(job);
        log.info("Downloader files deleted actor={} job={} owner={}", actor, id, job.getOwner());
    }

    public synchronized Path file(String id, String actor, String name) throws IOException {
        DownloadJob job = authorized(id, actor, false);
        if (!"READY".equals(job.getStatus()) || job.getExpiresAt() == null || job.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.GONE, "This file is not ready or has expired. Retry the download.");
        }
        disk.requireMounted("Download");
        Path directory = directory(job).resolve("output");
        Path file = directory.resolve(name == null ? job.getFileName() : name).normalize();
        if (!file.getParent().equals(directory) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found.");
        }
        return file;
    }

    public synchronized List<String> files(String id, String owner) throws IOException {
        DownloadJob job = authorized(id, owner, false);
        file(id, owner, null);
        try (var files = Files.list(directory(job).resolve("output"))) {
            return files.filter(path -> Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS)).map(path -> path.getFileName().toString()).sorted().toList();
        }
    }

    @Scheduled(fixedDelay = 1500)
    synchronized void dispatch() {
        if (stopping) return;
        Set<String> busy = new HashSet<>();
        for (String id : running.keySet()) repository.findById(id).ifPresent(job -> busy.add(job.getOwner()));
        for (DownloadJob job : repository.findByStatusInOrderByCreatedAtAsc(List.of("QUEUED"))) {
            if (!busy.add(job.getOwner())) continue;
            Running task = new Running();
            running.put(job.getId(), task);
            job.setStatus("DOWNLOADING");
            repository.save(job);
            Thread.startVirtualThread(() -> run(job, task));
        }
    }

    private void run(DownloadJob job, Running task) {
        try {
            disk.requireMounted("Media preparation");
            Path directory = directory(job);
            if (Files.exists(directory)) removeFiles(job);
            Path output = directory.resolve("output");
            Files.createDirectories(output);
            Path work = Files.createDirectories(directory.resolve("work"));
            if (Files.getFileStore(directory).getUsableSpace() < 256L * 1024 * 1024) throw new IOException("No space left on device");
            try (DownloadEgressProxy proxy = new DownloadEgressProxy()) {
                List<String> command = baseCommand(job.getUrl(), proxy);
                if ((job.getVideoFormat() != null && !job.getVideoFormat().isBlank()) || (job.getAudioFormat() != null && !job.getAudioFormat().isBlank())) {
                    validateTracks(inspect(job.getUrl(), false, task), job.getVideoFormat(), job.getAudioFormat(), job.getContainer());
                    if (task.cancelled) return;
                }
                command.addAll(DownloadPolicy.formatArguments(job.getPreset(), job.getQuality(), job.getVideoFormat(), job.getAudioFormat(), job.getContainer()));
                if (job.getAudioLanguage() != null && !job.getAudioLanguage().isBlank()) {
                    int selectorIndex = command.indexOf("-f") + 1;
                    String selector = command.get(selectorIndex);
                    command.set(selectorIndex, selector.replace("+ba", "+ba[language=" + job.getAudioLanguage() + "]"));
                }
                command.addAll(List.of("--no-playlist", "--no-simulate", "--newline", "--progress", "--progress-template", "download:DBPROGRESS:%(progress)j",
                        "--progress-template", "postprocess:DBPROCESS:%(progress)j", "--print", "after_move:DBFILE:%(filepath)j",
                        "--print", "before_dl:DBMETA:%(.{title,thumbnail})j", "-P", "home:" + output, "-P", "temp:" + work,
                        "-o", "%(title).120B [%(id)s].%(ext)s"));
                if (job.isSubtitles()) {
                    command.addAll(List.of("--write-subs", "--write-auto-subs", "--sub-langs",
                            job.getSubtitleLanguage() == null || job.getSubtitleLanguage().isBlank() ? "en" : job.getSubtitleLanguage()));
                }
                if (job.isThumbnailFile()) command.add("--write-thumbnail");
                command.addAll(List.of("--", job.getUrl()));
                execute(command, job, task, false);
            }
            if (!task.cancelled && (job.getStartSeconds() != null || job.getEndSeconds() != null)) trim(job, task, output);
            synchronized (this) {
                if (task.cancelled) return;
                Path result = job.getFileName() == null ? null : output.resolve(job.getFileName());
                if (result == null || !Files.isRegularFile(result) || Files.size(result) == 0) throw new IOException("No output file was produced");
                job.setStatus("READY");
                job.setBytesTotal(Files.size(result));
                job.setBytesDownloaded(Files.size(result));
                job.setProgress(100.0);
                job.setSpeed(0);
                job.setEta(null);
                job.setCompletedAt(Instant.now());
                job.setExpiresAt(Instant.now().plus(Duration.ofDays(7)));
                repository.save(job);
            }
        } catch (Exception exception) {
            synchronized (this) {
                if (!task.cancelled && !stopping) {
                    job.setStatus("FAILED");
                        job.setError(exception instanceof ResponseStatusException statusException
                            ? statusException.getReason() : failureReason(exception.getMessage()));
                    job.setSpeed(0);
                    job.setEta(null);
                    repository.save(job);
                    log.warn("Downloader failed job={} reason={}", job.getId(), job.getError());
                }
            }
        } finally {
            synchronized (this) {
                if (task.cancelled || !"READY".equals(job.getStatus())) {
                    try { removeFiles(job); } catch (IOException exception) { log.warn("Downloader cleanup pending job={}", job.getId()); }
                }
                running.remove(job.getId());
            }
        }
    }

    private List<String> baseCommand(String url, DownloadEgressProxy proxy) {
        DownloadPolicy.validateUrl(url);
        if (properties.getYtDlp() == null || properties.getYtDlp().isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "The media downloader is not configured.");
        }
        List<String> command = new ArrayList<>(List.of(properties.getYtDlp(), "--ignore-config", "--no-plugin-dirs",
            "--proxy", proxy.url(), "--downloader", "native", "--hls-prefer-native", "--socket-timeout", "30", "--retries", "3", "--fragment-retries", "3", "--no-warnings"));
        if (properties.getFfmpeg() != null && !properties.getFfmpeg().isBlank()) command.addAll(List.of("--ffmpeg-location", properties.getFfmpeg()));
        Path cookies = properties.getCookieForUrl(url);
        if (cookies != null) command.addAll(List.of("--cookies", cookies.toString()));
        return command;
    }

    private String execute(List<String> command, DownloadJob job, Running task, boolean probe) throws Exception {
        return execute(command, job, task, probe, Duration.ofSeconds(Math.max(1, probeTimeoutSeconds)));
    }

    String runProbeCommand(List<String> command, Duration timeout) throws Exception {
        return execute(command, null, null, true, timeout);
    }

    private String execute(List<String> command, DownloadJob job, Running task, boolean probe, Duration probeTimeout) throws Exception {
        long startedAt = System.nanoTime();
        String kind = probe ? "inspection" : "preparation";
        log.info("Media process launching kind={} tool={} timeoutSeconds={}", kind, DownloadDiagnostics.safeText(command.getFirst()), probe ? probeTimeout.toSeconds() : "idle:600");
        Process process;
        try { process = new ProcessBuilder(command).redirectErrorStream(true).start(); }
        catch (IOException exception) {
            log.warn("Media process launch failed kind={} elapsedMs={} diagnostic={}", kind,
                    Duration.ofNanos(System.nanoTime() - startedAt).toMillis(), DownloadDiagnostics.safeText(exception.getMessage()));
            throw exception;
        }
        log.info("Media process started kind={} pid={} startupMs={}", kind, process.pid(), Duration.ofNanos(System.nanoTime() - startedAt).toMillis());
        processes.add(process);
        if (task != null) {
            task.process = process;
            if (task.cancelled) stop(process);
        }
        AtomicLong lastActivity = new AtomicLong(System.currentTimeMillis());
        AtomicReference<String> stoppedBecause = new AtomicReference<>();
        Thread watchdog = Thread.startVirtualThread(() -> {
            try {
                while (process.isAlive()) {
                    Thread.sleep(probe ? 100 : 1000);
                    if (probe && System.nanoTime() - startedAt >= probeTimeout.toNanos()) {
                        stoppedBecause.compareAndSet(null, "Inspection exceeded " + probeTimeout.toSeconds() + " seconds. The source is too slow. Try again or inspect a single video instead of a playlist.");
                        stop(process);
                    } else if (!probe && System.currentTimeMillis() - lastActivity.get() > 600_000) {
                        stoppedBecause.compareAndSet(null, "Preparation stalled for 10 minutes with no output. Retry the download.");
                        stop(process);
                    }
                    if (!probe && Files.exists(root) && Files.getFileStore(root).getUsableSpace() < 64L * 1024 * 1024) {
                        stoppedBecause.compareAndSet(null, "Server storage is full. Ask an administrator to free space.");
                        stop(process);
                    }
                }
            } catch (InterruptedException exception) { Thread.currentThread().interrupt(); }
            catch (IOException exception) { stop(process); }
        });
        StringBuilder output = new StringBuilder();
        StringBuilder errors = new StringBuilder();
        StringBuilder diagnosticOutput = new StringBuilder();
        boolean firstOutput = true;
        long lastSaved = 0;
        try (BufferedReader reader = process.inputReader(StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (firstOutput) {
                    log.info("Media process first output kind={} pid={} elapsedMs={}", kind, process.pid(), Duration.ofNanos(System.nanoTime() - startedAt).toMillis());
                    firstOutput = false;
                }
                lastActivity.set(System.currentTimeMillis());
                if (probe && line.stripLeading().startsWith("{")) {
                    output.append(line);
                } else if (job != null && line.startsWith("DBFILE:")) {
                    job.setFileName(Path.of(json.readTree(line.substring(7)).asText()).getFileName().toString());
                } else if (job != null && line.startsWith("DBMETA:")) {
                    JsonNode metadata = json.readTree(line.substring(7));
                    job.setTitle(text(metadata, "title"));
                    job.setThumbnail(thumbnail(metadata));
                } else if (job != null && (line.startsWith("DBPROGRESS:") || line.startsWith("DBPROCESS:"))) {
                    JsonNode progress = json.readTree(line.substring(line.indexOf(':') + 1));
                    job.setStatus(line.startsWith("DBPROCESS:") ? "CONVERTING" : "DOWNLOADING");
                    job.setBytesDownloaded(progress.path("downloaded_bytes").asLong());
                    job.setBytesTotal(progress.path("total_bytes").asLong(progress.path("total_bytes_estimate").asLong()));
                    job.setSpeed(progress.path("speed").asDouble());
                    job.setEta(progress.path("eta").isNumber() ? progress.path("eta").asLong() : null);
                    job.setProgress(job.getBytesTotal() > 0 ? Math.min(99.9, job.getBytesDownloaded() * 100.0 / job.getBytesTotal()) : null);
                    if (System.currentTimeMillis() - lastSaved > 1500) {
                        synchronized (this) { if (!task.cancelled) repository.save(job); }
                        lastSaved = System.currentTimeMillis();
                    }
                } else {
                    errors.append(line).append('\n');
                    if (errors.length() > 8000) errors.delete(0, errors.length() - 8000);
                    String safeLine = DownloadDiagnostics.safeText(line);
                    diagnosticOutput.append(safeLine).append(" | ");
                    if (diagnosticOutput.length() > 8000) diagnosticOutput.delete(0, diagnosticOutput.length() - 8000);
                    if (probe) log.debug("Media probe output pid={} diagnostic={}", process.pid(), safeLine);
                }
            }
            int exit = process.waitFor();
            log.info("Media process exited kind={} pid={} exit={} elapsedMs={} stdoutChars={}", kind, process.pid(), exit,
                    Duration.ofNanos(System.nanoTime() - startedAt).toMillis(), output.length());
            if (stoppedBecause.get() != null) {
                log.warn("Media process stopped kind={} pid={} reason={} diagnostic={}", kind, process.pid(), stoppedBecause.get(), DownloadDiagnostics.safeText(diagnosticOutput.toString()));
                if (probe) throw new java.net.SocketTimeoutException(stoppedBecause.get());
                throw new IOException(stoppedBecause.get());
            }
            if (exit != 0) {
                log.warn("Media process failed kind={} pid={} exit={} elapsedMs={} reason={} diagnostic={}", kind, process.pid(), exit,
                    Duration.ofNanos(System.nanoTime() - startedAt).toMillis(), failureReason(errors.toString()), DownloadDiagnostics.safeText(diagnosticOutput.toString()));
                throw new IOException(errors.toString());
            }
                if (probe && !diagnosticOutput.isEmpty()) log.warn("Media inspection tool warnings pid={} diagnostic={}", process.pid(), DownloadDiagnostics.safeText(diagnosticOutput.toString()));
            return output.toString();
        } catch (IOException exception) {
                log.warn("Media process IO failure kind={} pid={} elapsedMs={} stopReason={} diagnostic={} outputTail={}", kind, process.pid(),
                    Duration.ofNanos(System.nanoTime() - startedAt).toMillis(), stoppedBecause.get(),
                    DownloadDiagnostics.safeText(exception.getMessage()), DownloadDiagnostics.safeText(diagnosticOutput.toString()));
            if (stoppedBecause.get() != null && probe) throw new java.net.SocketTimeoutException(stoppedBecause.get());
            throw exception;
        } finally {
            watchdog.interrupt();
            stop(process);
            processes.remove(process);
        }
    }

    private void trim(DownloadJob job, Running task, Path output) throws Exception {
        if (properties.getFfmpeg() == null || properties.getFfmpeg().isBlank()) throw new IOException("ffmpeg is not configured");
        Path source = output.resolve(job.getFileName());
        Path target = source.resolveSibling("clip-" + source.getFileName());
        List<String> command = new ArrayList<>(List.of(properties.getFfmpeg(), "-nostdin", "-y", "-protocol_whitelist", "file,pipe,crypto,data", "-i", source.toString(),
                "-ss", String.valueOf(job.getStartSeconds() == null ? 0 : job.getStartSeconds())));
        if (job.getEndSeconds() != null) command.addAll(List.of("-t", String.valueOf(job.getEndSeconds() - (job.getStartSeconds() == null ? 0 : job.getStartSeconds()))));
        command.addAll(List.of("-map", "0", "-c", "copy", target.toString()));
        synchronized (this) { if (!task.cancelled) { job.setStatus("CONVERTING"); repository.save(job); } }
        execute(command, null, task, false);
        if (!task.cancelled) {
            Files.delete(source);
            job.setFileName(target.getFileName().toString());
        }
    }

    public String ticket(String owner, List<String> ids, String name, boolean nativeClient) throws IOException {
        if (ids == null || ids.isEmpty()) badRequest("Select ready files.");
        Instant expiry = Instant.now().plusSeconds(nativeClient ? 604_800 : 300);
        for (String id : ids) {
            file(id, owner, ids.size() == 1 ? name : null);
            Instant fileExpiry = authorized(id, owner, false).getExpiresAt();
            if (fileExpiry.isBefore(expiry)) expiry = fileExpiry;
        }
        byte[] random = new byte[32];
        new java.security.SecureRandom().nextBytes(random);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
        tickets.put(token, new Ticket(owner, List.copyOf(ids), name, expiry));
        return "/api/downloader/transfers/" + token;
    }

    Ticket redeem(String token) {
        Ticket ticket = tickets.get(token);
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now())) {
            tickets.remove(token);
            throw new ResponseStatusException(HttpStatus.GONE, "Download link expired. Press Save to Device again.");
        }
        return ticket;
    }

    static String failureReason(String message) {
        String lower = Objects.toString(message, "").toLowerCase(Locale.ROOT);
        if (lower.contains("inspection exceeded")) return message;
        if (lower.contains("stalled for 10 minutes")) return "Preparation stalled for 10 minutes with no output. Retry the download.";
        if (lower.contains("javascript runtime") || lower.contains("js runtime") || lower.contains("n challenge") || lower.contains("signature solving")) return "YouTube extraction requires an up-to-date yt-dlp and supported JavaScript runtime. Ask an administrator to check the server tools.";
        if (lower.contains("not a bot") || lower.contains("confirm you're not")) return "The source requires a browser verification. Ask an administrator to refresh the shared cookies.";
        if (lower.contains("drm")) return "This video is DRM-protected and cannot be downloaded here.";
        if (lower.contains("unsupported url") || lower.contains("no suitable extractor")) return "This site or URL is not supported by the installed yt-dlp version.";
        if (lower.contains("cookie") || lower.contains("sign in") || lower.contains("login") || lower.contains("401")) return "The source requires authentication. Ask an administrator to refresh the shared cookies.";
        if (lower.contains("private") || lower.contains("unavailable") || lower.contains("404")) return "This video is private, removed, or unavailable to the server.";
        if (lower.contains("country") || lower.contains("geo")) return "This video is not available in the server's region.";
        if (lower.contains("429")) return "The source is rate-limiting requests. Wait before retrying.";
        if (lower.contains("403")) return "The source refused access. Its permissions or shared cookies may need updating.";
        if (lower.contains("space") || lower.contains("disk")) return "Server storage is unavailable or full. Ask an administrator to check the media disk.";
        if (lower.contains("ffmpeg") || lower.contains("cannot run program")) return "A required server tool is missing or failed. Ask an administrator to check yt-dlp and FFmpeg.";
        if (lower.contains("format")) return "The selected format or language is unavailable. Try Recommended or another quality.";
        if (lower.contains("timed out") || lower.contains("connection") || lower.contains("network") || lower.contains("remote end closed") || lower.contains("unable to download webpage")) return "The source connection failed or stalled. Retry when the source is reachable.";
        return "The source or media processor failed, or preparation stalled. Retry with Recommended; ask an administrator to check the server tools if it persists.";
    }

    @Scheduled(fixedDelay = 60_000)
    public synchronized int cleanup() throws IOException {
        tickets.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(Instant.now()));
        if (!disk.isMounted()) return 0;
        int count = 0;
        for (DownloadJob job : repository.findByExpiresAtBeforeAndStatus(Instant.now(), "READY")) {
            removeFiles(job);
            job.setStatus("EXPIRED");
            job.setFileName(null);
            repository.save(job);
            count++;
        }
        if (count > 0) log.info("Downloader expired files jobs={}", count);
        return count;
    }

    private Path directory(DownloadJob job) {
        String ownerFolder = UUID.nameUUIDFromBytes(job.getOwner().getBytes(StandardCharsets.UTF_8)).toString();
        return root.resolve(ownerFolder).resolve(job.getId());
    }

    private void removeFiles(DownloadJob job) throws IOException {
        disk.requireMounted("Download cleanup");
        Path directory = directory(job);
        if (!Files.exists(directory, LinkOption.NOFOLLOW_LINKS)) return;
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
        }
    }

    private static JobView view(DownloadJob job, int position) {
        return new JobView(job.getId(), job.getOwner(), job.getUrl() == null ? null : java.net.URI.create(job.getUrl()).getHost(), job.getTitle(), job.getThumbnail(), job.getPreset(), job.getQuality(),
                job.getStatus(), job.getFileName(), job.getBytesDownloaded(), job.getBytesTotal(), job.getSpeed(), job.getEta(),
                job.getProgress(), job.getError(), job.getCreatedAt(), job.getExpiresAt(), position);
    }

    private static String text(JsonNode node, String key) { return node.path(key).isString() ? node.path(key).asText() : null; }
    private static Double number(JsonNode node, String key) { return node.path(key).isNumber() ? node.path(key).asDouble() : null; }
    private static String thumbnail(JsonNode node) {
        String value = text(node, "thumbnail");
        return value != null && value.startsWith("https://") ? value : null;
    }
    private static void badRequest(String reason) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason); }
    private static void stop(Process process) {
        if (process != null) {
            process.descendants().forEach(ProcessHandle::destroyForcibly);
            process.destroyForcibly();
        }
    }

    @PreDestroy void shutdown() {
        stopping = true;
        processes.forEach(MediaDownloaderService::stop);
    }
}