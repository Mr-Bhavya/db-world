package com.db.dbworld.hls;

import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@Slf4j
@RequiredArgsConstructor
@Transactional
public class HLSMediaProcessor {

    @Value("${hls.output.base-path:D:\\Bhavya\\Videos}")
    private String baseOutputPath;

    @Value("${hls.segment.duration:6}")
    private int segmentDuration;

    @Value("${ffmpeg.path:ffmpeg}")
    private String ffmpegPath;

    @Value("${hls.base-url:http://localhost:9000}")
    private String hlsBaseUrl;

    @Value("${hls.streaming.base-path:/api/hls}")
    private String streamingBasePath;

    @Value("${hls.ffmpeg.timeout.hours:2}")
    private int ffmpegTimeoutHours;

    @Value("${hls.cleanup.enabled:true}")
    private boolean cleanupEnabled;

    @Value("${hls.cleanup.older-than-days:30}")
    private int cleanupOlderThanDays;

    private final HLSContentRepository hlsContentRepository;
    private final HLSVariantRepository hlsVariantRepository;
    private final HLSPlaybackSessionRepository hlsPlaybackSessionRepository;

    private final ExecutorService executorService = Executors.newFixedThreadPool(3);
    private final Map<Long, HLSProcessingProgress> processingProgressMap = new ConcurrentHashMap<>();

    /**
     * Main processing method that accepts MediaFileInfoEntity and MediaFileDetails
     */
    public HLSProcessingResult processMediaFile(MediaFileInfoEntity mediaInfo,
                                                MediaFileDetails fileDetails) {

        log.info("Starting HLS processing for media file: {}", mediaInfo.getFileName());
        log.debug("Record ID: {}, Type: {}", fileDetails.getRecordId(), fileDetails.getRecordType());

        HLSProcessingResult result = new HLSProcessingResult();
        result.setMediaFileId(mediaInfo.getId());
        result.setFileName(mediaInfo.getFileName());
        result.setRecordId(fileDetails.getRecordId());
        result.setRecordType(fileDetails.getRecordType());
        result.setStartTime(LocalDateTime.now());

        // Create progress tracker
        HLSProcessingProgress progress = new HLSProcessingProgress();
        progress.setRecordId(fileDetails.getRecordId());
        progress.setMediaFileId(mediaInfo.getId());
        progress.setStatus(HLSStatus.GENERATING);
        progress.setStartTime(LocalDateTime.now());
        progress.setCurrentStep("Initializing");
        progress.setProgress(0);
        processingProgressMap.put(fileDetails.getRecordId(), progress);

        try {
            // 1. Validate inputs
            progress.setCurrentStep("Validating inputs");
            progress.setProgress(5);
            validateInputs(mediaInfo, fileDetails);

            // 2. Extract video information
            progress.setCurrentStep("Extracting video information");
            progress.setProgress(10);
            VideoInfoEntity videoTrack = getPrimaryVideoTrack(mediaInfo);
            if (videoTrack == null) {
                throw new DbWorldException("No video track found in media file");
            }

            result.setVideoWidth(videoTrack.getWidth());
            result.setVideoHeight(videoTrack.getHeight());
            result.setVideoCodec(videoTrack.getFormat());

            // 3. Determine output path based on record type
            progress.setCurrentStep("Determining output path");
            progress.setProgress(15);
            Path outputFolder = determineOutputPath(fileDetails, videoTrack);
            result.setOutputFolder(outputFolder.toString());

            log.info("Output folder: {}", outputFolder);

            // 4. Check if already processed
            progress.setCurrentStep("Checking existing HLS");
            progress.setProgress(20);
            if (isAlreadyProcessed(outputFolder, mediaInfo)) {
                log.info("HLS already exists for {}", mediaInfo.getFileName());
                result.setStatus(HLSStatus.ALREADY_EXISTS);
                result.setMessage("HLS files already generated");
                progress.setStatus(HLSStatus.COMPLETED);
                progress.setProgress(100);
                progress.setEndTime(LocalDateTime.now());
                return result;
            }

            // 5. Create output directory
            progress.setCurrentStep("Creating directories");
            progress.setProgress(25);
            Files.createDirectories(outputFolder);

            // 6. Get audio tracks
            progress.setCurrentStep("Analyzing audio tracks");
            progress.setProgress(30);
            List<AudioInfoEntity> audioTracks = getAudioTracks(mediaInfo);
            result.setAudioTrackCount(audioTracks.size());

            // 7. Build source file path
            progress.setCurrentStep("Locating source file");
            progress.setProgress(35);
            Path sourceFilePath = Paths.get(mediaInfo.getFilePath());
            if (!Files.exists(sourceFilePath)) {
                // Try alternative path from fileDetails
                sourceFilePath = Paths.get(fileDetails.getStreamFilePath());
                if (!Files.exists(sourceFilePath)) {
                    throw new DbWorldException("Source file not found: " + mediaInfo.getFilePath());
                }
            }

            log.info("Source file path: {}", sourceFilePath);

            // 8. Generate HLS
            progress.setCurrentStep("Generating HLS files");
            progress.setProgress(40);
            generateHLSFiles(sourceFilePath, outputFolder, videoTrack, audioTracks);

            // 9. Create status metadata
            progress.setCurrentStep("Creating metadata");
            progress.setProgress(80);
            createProcessingMetadata(outputFolder, mediaInfo, fileDetails, videoTrack, audioTracks);

            // 10. Update master playlist
            progress.setCurrentStep("Updating master playlist");
            progress.setProgress(85);
            updateMasterPlaylist(fileDetails, outputFolder.getParent(), videoTrack);

            // 11. Save to database
            progress.setCurrentStep("Saving to database");
            progress.setProgress(90);
            HLSContentEntity hlsContent = saveHLSContent(mediaInfo, fileDetails, outputFolder, videoTrack);
            result.setHlsContentId(hlsContent.getId());

            // 12. Set success result
            progress.setCurrentStep("Finalizing");
            progress.setProgress(95);
            result.setStatus(HLSStatus.COMPLETED);
            result.setMessage("HLS generation completed successfully");
            result.setSegmentCount(countSegments(outputFolder));
            result.setPlaylistUrl(constructPlaylistUrl(fileDetails, outputFolder));

            log.info("Successfully processed {} - {}",
                    mediaInfo.getFileName(), result.getStatus());

        } catch (Exception e) {
            log.error("Failed to process media file: {}", mediaInfo.getFileName(), e);
            result.setStatus(HLSStatus.FAILED);
            result.setErrorMessage(e.getMessage());
            result.setErrorDetails(e.getClass().getSimpleName());
            progress.setStatus(HLSStatus.FAILED);
            progress.setErrorMessage(e.getMessage());
        } finally {
            result.setEndTime(LocalDateTime.now());
            if (result.getStartTime() != null && result.getEndTime() != null) {
                result.setProcessingTime(java.time.Duration.between(
                        result.getStartTime(), result.getEndTime()
                ).toMillis());
            }

            progress.setEndTime(LocalDateTime.now());
            progress.setProgress(100);

            // Remove progress tracker after 5 minutes
            scheduleProgressCleanup(fileDetails.getRecordId());
        }

        return result;
    }

    /**
     * Generate HLS files using FFmpeg
     */
    private void generateHLSFiles(Path sourcePath, Path outputFolder,
                                  VideoInfoEntity videoTrack,
                                  List<AudioInfoEntity> audioTracks) throws Exception {

        List<String> command = buildFFmpegCommand(sourcePath, outputFolder, videoTrack, audioTracks);

        log.info("Generating HLS for: {} -> {}",
                sourcePath.getFileName(), outputFolder);
        log.debug("FFmpeg command: {}", String.join(" ", command));

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);

        // Execute with timeout
        CompletableFuture<ProcessResult> future = CompletableFuture.supplyAsync(() -> {
            try {
                Process process = processBuilder.start();

                // Capture output for progress tracking
                StringBuilder output = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        output.append(line).append("\n");

                        // Parse progress from FFmpeg output
                        if (line.contains("time=")) {
                            try {
                                // Example: time=00:01:23.45
                                String timeStr = line.split("time=")[1].split(" ")[0];
                                updateProgressFromTime(timeStr, sourcePath);
                            } catch (Exception e) {
                                log.debug("Could not parse time from FFmpeg output: {}", line);
                            }
                        }

                        if (line.contains("frame=") || line.contains("time=")) {
                            log.debug("FFmpeg: {}", line);
                        }
                    }
                }

                int exitCode = process.waitFor();
                return new ProcessResult(exitCode, output.toString());

            } catch (Exception e) {
                throw new RuntimeException("FFmpeg execution failed", e);
            }
        }, executorService);

        ProcessResult result = future.get(ffmpegTimeoutHours, TimeUnit.HOURS);

        if (result.exitCode != 0) {
            log.error("FFmpeg failed with exit code: {}", result.exitCode);
            log.error("FFmpeg output:\n{}", result.output);
            throw new DbWorldException("FFmpeg processing failed. Exit code: " + result.exitCode);
        }

        log.info("HLS generation completed for {}", sourcePath.getFileName());
    }

    /**
     * Build FFmpeg command
     */
    private List<String> buildFFmpegCommand(Path sourcePath, Path outputFolder,
                                            VideoInfoEntity videoTrack,
                                            List<AudioInfoEntity> audioTracks) {
        List<String> command = new ArrayList<>();
        command.add(ffmpegPath);
        command.add("-hwaccel");
        command.add("auto"); // Auto-detect hardware acceleration

        command.add("-i");
        command.add(sourcePath.toString());

        // Video stream
        command.add("-map");
        command.add("0:v:0");
        command.add("-c:v");
        command.add("copy");

        // Detect video codec and use appropriate bitstream filter
        String videoCodec = videoTrack.getFormat();
        String bitstreamFilter = determineBitstreamFilter(videoCodec);
        if (bitstreamFilter != null) {
            command.add("-bsf:v");
            command.add(bitstreamFilter);
        }

        // Handle audio streams
        for (int i = 0; i < audioTracks.size(); i++) {
            AudioInfoEntity audio = audioTracks.get(i);
            command.add("-map");
            command.add("0:a:" + i);

            String audioCodec = determineAudioCodec(audio);
            if ("copy".equals(audioCodec)) {
                command.add("-c:a:" + i);
                command.add("copy");
            } else {
                command.add("-c:a:" + i);
                command.add("aac");

                // Add bitrate parameter
                String bitrate = getAudioBitrate(audio);
                command.add("-b:a:" + i);
                command.add(bitrate);

                // Add channel count
                int channels = getAudioChannels(audio);
                command.add("-ac:a:" + i);
                command.add(String.valueOf(channels));
            }
        }

        // HLS parameters
        command.add("-f");
        command.add("hls");
        command.add("-hls_time");
        command.add(String.valueOf(segmentDuration));
        command.add("-hls_playlist_type");
        command.add("vod");
        command.add("-hls_segment_type");
        command.add("mpegts");
        command.add("-hls_segment_filename");
        command.add(outputFolder.resolve("segment_%03d.ts").toString());
        command.add("-hls_list_size");
        command.add("0");
        command.add("-hls_flags");
        command.add("independent_segments");

        // Add progress reporting
        command.add("-progress");
        command.add("pipe:1");

        // Output file
        command.add(outputFolder.resolve("index.m3u8").toString());

        return command;
    }

    private String determineBitstreamFilter(String videoCodec) {
        if (videoCodec == null) return null;

        String codecLower = videoCodec.toLowerCase();
        if (codecLower.contains("h265") || codecLower.contains("hevc")) {
            return "hevc_mp4toannexb";
        } else if (codecLower.contains("h264") || codecLower.contains("avc")) {
            return "h264_mp4toannexb";
        } else if (codecLower.contains("av1")) {
            return "av1_mp4toannexb";
        }
        return null; // No bitstream filter for other codecs
    }

    /**
     * Determine audio codec - returns "copy" or "aac"
     */
    private String determineAudioCodec(AudioInfoEntity audio) {
        String format = audio.getFormat();
        if (format == null) {
            return "copy";
        }

        format = format.toLowerCase();

        // Codecs that can be copied directly
        if (format.contains("aac") || format.contains("mp3") ||
                format.contains("mp2") || format.contains("opus") ||
                format.contains("flac") || format.contains("ac3") ||
                format.contains("eac3")) {
            return "copy";
        }

        // Convert other codecs to AAC
        return "aac";
    }

    /**
     * Get audio bitrate parameter
     */
    private String getAudioBitrate(AudioInfoEntity audio) {
        Integer bitrate = audio.getBitRate();
        if (bitrate != null && bitrate > 0) {
            // Convert to kbps, cap at 320k
            int kbps = (int) Math.ceil(bitrate / 1000.0);
            return Math.min(kbps, 320) + "k";
        }
        return "128k"; // Default
    }

    /**
     * Get audio channel count
     */
    private int getAudioChannels(AudioInfoEntity audio) {
        if (audio.getChannels() != null) {
            return Math.min(audio.getChannels(), 6); // Max 5.1 channels
        }
        return 2; // Default stereo
    }

    /**
     * Determine output path based on record type and structure
     */
    private Path determineOutputPath(MediaFileDetails fileDetails, VideoInfoEntity videoTrack) {
        Path basePath = Paths.get(baseOutputPath);

        // Build path based on record type
        switch (fileDetails.getRecordType()) {
            case MOVIE:
                return buildMoviePath(basePath, fileDetails, videoTrack);

            case SERIES:
                return buildSeriesPath(basePath, fileDetails, videoTrack);

            default:
                return buildGenericPath(basePath, fileDetails, videoTrack);
        }
    }

    /**
     * Build path for movies: {base}/recordId-MovieName/hls/resolution/
     */
    private Path buildMoviePath(Path basePath, MediaFileDetails fileDetails, VideoInfoEntity videoTrack) {
        String folderName;
        if (fileDetails.getYear() != null && !fileDetails.getYear().isEmpty()) {
            folderName = fileDetails.getRecordId() + "-" + fileDetails.getName() + " (" + fileDetails.getYear() + ")";
        } else {
            folderName = fileDetails.getRecordId() + "-" + fileDetails.getName();
        }

        Path movieFolder = basePath.resolve("movies").resolve(folderName);
        String resolutionFolder = getResolutionFolderName(videoTrack);

        return movieFolder.resolve("hls").resolve(resolutionFolder);
    }

    /**
     * Build path for series
     */
    private Path buildSeriesPath(Path basePath, MediaFileDetails fileDetails, VideoInfoEntity videoTrack) {
        String seriesFolder = fileDetails.getRecordId() + "-" + fileDetails.getName();
        Path seriesPath = basePath.resolve("series").resolve(seriesFolder);

        if (fileDetails.getSeason() != null && !fileDetails.getSeason().isEmpty()) {
            seriesPath = seriesPath.resolve("Season " + fileDetails.getSeason());
        }

        String resolutionFolder = getResolutionFolderName(videoTrack);
        return seriesPath.resolve("hls").resolve(resolutionFolder);
    }

    /**
     * Build path for episodes
     */
    private Path buildEpisodePath(Path basePath, MediaFileDetails fileDetails, VideoInfoEntity videoTrack) {
        Path episodePath = basePath.resolve(fileDetails.getRecordIdFolder());

        // Add season folder if available
        if (fileDetails.getSeason() != null && !fileDetails.getSeason().isEmpty()) {
            episodePath = episodePath.resolve("Season " + fileDetails.getSeason());
        }

        String resolutionFolder = getResolutionFolderName(videoTrack);
        return episodePath.resolve("hls").resolve(resolutionFolder);
    }

    /**
     * Build generic path
     */
    private Path buildGenericPath(Path basePath, MediaFileDetails fileDetails, VideoInfoEntity videoTrack) {
        Path recordPath = basePath.resolve(fileDetails.getRecordIdFolder());
        String resolutionFolder = getResolutionFolderName(videoTrack);
        return recordPath.resolve("hls").resolve(resolutionFolder);
    }

    /**
     * Get resolution folder name with HDR/DV detection
     */
    private String getResolutionFolderName(VideoInfoEntity videoTrack) {
        Integer width = videoTrack.getWidth();
        Integer height = videoTrack.getHeight();

        if (width == null || height == null) {
            return "original";
        }

        // Detect HDR/DV
        boolean isHDR = videoTrack.getHdrFormat() != null &&
                !videoTrack.getHdrFormat().isEmpty();
        boolean isDV = videoTrack.getFormatProfile() != null &&
                videoTrack.getFormatProfile().toLowerCase().contains("dolby");

        // Determine resolution
        String baseResolution;
        if (width >= 3840 || height >= 2160) {
            baseResolution = "2160p";
        } else if (width >= 1920 || height >= 1080) {
            baseResolution = "1080p";
        } else if (width >= 1280 || height >= 720) {
            baseResolution = "720p";
        } else if (width >= 854 || height >= 480) {
            baseResolution = "480p";
        } else {
            baseResolution = "original";
        }

        // Add HDR/DV suffix
        if (isDV) {
            return baseResolution + "_dv";
        } else if (isHDR) {
            return baseResolution + "_hdr";
        } else {
            return baseResolution;
        }
    }

    /**
     * Create processing metadata file
     */
    private void createProcessingMetadata(Path outputFolder,
                                          MediaFileInfoEntity mediaInfo,
                                          MediaFileDetails fileDetails,
                                          VideoInfoEntity videoTrack,
                                          List<AudioInfoEntity> audioTracks) throws Exception {

        Map<String, Object> metadata = new LinkedHashMap<>();

        // Basic info
        metadata.put("media_file_id", mediaInfo.getId());
        metadata.put("record_id", fileDetails.getRecordId());
        metadata.put("record_type", fileDetails.getRecordType().toString());
        metadata.put("name", fileDetails.getName());
        metadata.put("year", fileDetails.getYear());

        // File info
        metadata.put("file_name", mediaInfo.getFileName());
        metadata.put("file_size", mediaInfo.getFileSize());
        metadata.put("original_path", mediaInfo.getFilePath());

        // Video info
        Map<String, Object> videoInfo = new HashMap<>();
        videoInfo.put("width", videoTrack.getWidth());
        videoInfo.put("height", videoTrack.getHeight());
        videoInfo.put("codec", videoTrack.getFormat());
        videoInfo.put("bitrate", videoTrack.getBitRate());
        videoInfo.put("frame_rate", videoTrack.getFrameRate());
        videoInfo.put("hdr_format", videoTrack.getHdrFormat());
        videoInfo.put("bit_depth", videoTrack.getBitDepth());
        metadata.put("video", videoInfo);

        // Audio tracks
        List<Map<String, Object>> audioList = new ArrayList<>();
        for (AudioInfoEntity audio : audioTracks) {
            Map<String, Object> audioInfo = new HashMap<>();
            audioInfo.put("format", audio.getFormat());
            audioInfo.put("channels", audio.getChannels());
            audioInfo.put("bitrate", audio.getBitRate());
            audioInfo.put("sample_rate", audio.getSamplingRate());
            audioInfo.put("language", audio.getLanguage());
            audioInfo.put("title", audio.getTitle());
            audioList.add(audioInfo);
        }
        metadata.put("audio_tracks", audioList);

        // Processing info
        metadata.put("generated_at", LocalDateTime.now().format(DateTimeFormatter.ISO_DATE_TIME));
        metadata.put("segment_duration", segmentDuration);
        metadata.put("hls_version", "6");

        // Write JSON file
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);

        Path metadataFile = outputFolder.resolve("metadata.json");
        mapper.writeValue(metadataFile.toFile(), metadata);

        log.debug("Created metadata file: {}", metadataFile);
    }

    /**
     * Update master playlist for the content
     */
    private void updateMasterPlaylist(MediaFileDetails fileDetails,
                                      Path contentFolder,
                                      VideoInfoEntity videoTrack) throws IOException {

        Path hlsFolder = contentFolder.resolve("hls");
        log.info("Looking for HLS folder at: {}", hlsFolder);

        if (!Files.exists(hlsFolder)) {
            log.warn("HLS folder does not exist: {}", hlsFolder);
            log.info("Creating HLS folder...");
            Files.createDirectories(hlsFolder);
        }

        // Find all resolution folders
        List<Path> resolutionFolders;
        try (Stream<Path> stream = Files.list(hlsFolder)) {
            resolutionFolders = stream
                    .filter(Files::isDirectory)
                    .filter(dir -> {
                        boolean hasPlaylist = Files.exists(dir.resolve("index.m3u8"));
                        if (hasPlaylist) {
                            log.info("Found resolution folder with playlist: {}", dir.getFileName());
                        }
                        return hasPlaylist;
                    })
                    .sorted(this::compareResolutionFolders)
                    .collect(Collectors.toList());
        }

        log.info("Found {} resolution folders with playlists", resolutionFolders.size());

        // If no resolution folders found, check if we just created one
        if (resolutionFolders.isEmpty()) {
            log.warn("No resolution folders with playlists found. Checking current resolution...");

            // Get current resolution folder name
            String currentResolution = getResolutionFolderName(videoTrack);
            Path currentResolutionFolder = hlsFolder.resolve(currentResolution);

            if (Files.exists(currentResolutionFolder) &&
                    Files.exists(currentResolutionFolder.resolve("index.m3u8"))) {
                resolutionFolders = List.of(currentResolutionFolder);
                log.info("Found current resolution folder: {}", currentResolution);
            } else {
                log.error("Current resolution folder also not found: {}", currentResolutionFolder);
                // Create master playlist anyway with single variant
                createSimpleMasterPlaylist(hlsFolder, fileDetails, videoTrack, currentResolution);
                return;
            }
        }

        // Generate master playlist
        List<String> masterLines = new ArrayList<>();
        masterLines.add("#EXTM3U");
        masterLines.add("#EXT-X-VERSION:6");
        masterLines.add("# Created: " + LocalDateTime.now());
        masterLines.add("# Content: " + fileDetails.getName());

        if (fileDetails.getYear() != null && !fileDetails.getYear().isEmpty()) {
            masterLines.add("# Year: " + fileDetails.getYear());
        }

        for (Path resolutionFolder : resolutionFolders) {
            String resolutionName = resolutionFolder.getFileName().toString();
            log.info("Processing resolution: {}", resolutionName);

            // Get video info for this specific variant
            VideoInfoEntity variantVideoTrack = getVideoTrackForResolution(videoTrack, resolutionName);

            String bandwidth = estimateBandwidth(variantVideoTrack);
            String resolution = variantVideoTrack.getWidth() + "x" + variantVideoTrack.getHeight();
            String codecs = getCodecsString(variantVideoTrack);

            masterLines.add(String.format(
                    "#EXT-X-STREAM-INF:BANDWIDTH=%s,RESOLUTION=%s,CODECS=\"%s\",NAME=\"%s\"",
                    bandwidth, resolution, codecs, resolutionName
            ));
            masterLines.add(resolutionName + "/index.m3u8");
        }

        // Write master playlist
        Path masterPlaylist = hlsFolder.resolve("master.m3u8");
        log.info("Writing master playlist to: {}", masterPlaylist);

        Files.write(masterPlaylist, masterLines, StandardCharsets.UTF_8);

        log.info("Master playlist created successfully with {} variants", resolutionFolders.size());
    }

    /**
     * Create a simple master playlist when no resolution folders are found
     */
    private void createSimpleMasterPlaylist(Path hlsFolder, MediaFileDetails fileDetails,
                                            VideoInfoEntity videoTrack, String resolutionName) throws IOException {

        log.info("Creating simple master playlist with resolution: {}", resolutionName);

        List<String> masterLines = new ArrayList<>();
        masterLines.add("#EXTM3U");
        masterLines.add("#EXT-X-VERSION:6");
        masterLines.add("# Created: " + LocalDateTime.now());
        masterLines.add("# Content: " + fileDetails.getName());

        if (fileDetails.getYear() != null && !fileDetails.getYear().isEmpty()) {
            masterLines.add("# Year: " + fileDetails.getYear());
        }

        String bandwidth = estimateBandwidth(videoTrack);
        String resolution = videoTrack.getWidth() + "x" + videoTrack.getHeight();
        String codecs = getCodecsString(videoTrack);

        masterLines.add(String.format(
                "#EXT-X-STREAM-INF:BANDWIDTH=%s,RESOLUTION=%s,CODECS=\"%s\"",
                bandwidth, resolution, codecs
        ));
        masterLines.add(resolutionName + "/index.m3u8");

        Path masterPlaylist = hlsFolder.resolve("master.m3u8");
        Files.write(masterPlaylist, masterLines, StandardCharsets.UTF_8);

        log.info("Simple master playlist created at: {}", masterPlaylist);
    }

    /**
     * Construct playlist URL for the result
     */
    private String constructPlaylistUrl(MediaFileDetails fileDetails, Path outputFolder) {
        return String.format("%s/playback/%s",
                hlsBaseUrl + streamingBasePath,
                fileDetails.getRecordId());
    }

    // Helper methods

    private VideoInfoEntity getPrimaryVideoTrack(MediaFileInfoEntity mediaInfo) {
        return mediaInfo.getTrackInfos().stream()
                .filter(track -> track instanceof VideoInfoEntity)
                .map(track -> (VideoInfoEntity) track)
                .findFirst()
                .orElse(null);
    }

    private List<AudioInfoEntity> getAudioTracks(MediaFileInfoEntity mediaInfo) {
        return mediaInfo.getTrackInfos().stream()
                .filter(track -> track instanceof AudioInfoEntity)
                .map(track -> (AudioInfoEntity) track)
                .collect(Collectors.toList());
    }

    private void validateInputs(MediaFileInfoEntity mediaInfo, MediaFileDetails fileDetails) {
        if (mediaInfo == null) {
            throw new DbWorldException("MediaFileInfoEntity cannot be null");
        }
        if (fileDetails == null) {
            throw new DbWorldException("MediaFileDetails cannot be null");
        }
        if (fileDetails.getRecordId() == null) {
            throw new DbWorldException("Record ID cannot be null");
        }
        if (mediaInfo.getTrackInfos() == null || mediaInfo.getTrackInfos().isEmpty()) {
            throw new DbWorldException("No track information available");
        }
    }

    private boolean isAlreadyProcessed(Path outputFolder, MediaFileInfoEntity mediaInfo) {
        if (!Files.exists(outputFolder)) {
            return false;
        }

        Path playlist = outputFolder.resolve("index.m3u8");
        Path metadata = outputFolder.resolve("metadata.json");

        if (!Files.exists(playlist) || !Files.exists(metadata)) {
            return false;
        }

        // Check if metadata matches current media info
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<?, ?> existingMetadata = mapper.readValue(metadata.toFile(), Map.class);
            String existingFileId = (String) existingMetadata.get("media_file_id");
            return mediaInfo.getId().equals(existingFileId);
        } catch (Exception e) {
            return false;
        }
    }

    private int countSegments(Path outputFolder) throws IOException {
        try (var paths = Files.list(outputFolder)) {
            return (int) paths
                    .filter(path -> path.getFileName().toString().endsWith(".ts"))
                    .count();
        }
    }

    private String estimateBandwidth(VideoInfoEntity videoTrack) {
        Integer bitrate = videoTrack.getBitRate();
        if (bitrate != null && bitrate > 0) {
            return String.valueOf(bitrate);
        }

        Integer height = videoTrack.getHeight();
        if (height == null) return "2000000";

        // Bandwidth estimates for common resolutions
        if (height >= 2160) return "25000000";    // 4K
        else if (height >= 1080) return "8000000"; // 1080p
        else if (height >= 720) return "5000000";  // 720p
        else if (height >= 480) return "2000000";  // 480p
        else return "1000000";                     // 360p or lower
    }

    private String getCodecsString(VideoInfoEntity videoTrack) {
        String format = videoTrack.getFormat();
        if (format == null) return "avc1.640028";

        format = format.toLowerCase();
        if (format.contains("h264") || format.contains("avc")) {
            return "avc1.640028";
        } else if (format.contains("h265") || format.contains("hevc")) {
            return "hvc1.1.6.L123.B0";
        } else if (format.contains("vp9")) {
            return "vp09.00.50.08";
        } else if (format.contains("av1")) {
            return "av01.0.08M.08";
        }
        return "avc1.640028";
    }

    private int compareResolutionFolders(Path a, Path b) {
        Map<String, Integer> order = Map.of(
                "2160p_dv", 1000,
                "2160p_hdr", 900,
                "2160p", 800,
                "1080p_dv", 700,
                "1080p_hdr", 600,
                "1080p", 500,
                "720p", 400,
                "480p", 300,
                "360p", 200,
                "original", 100
        );

        String aName = a.getFileName().toString();
        String bName = b.getFileName().toString();

        return Integer.compare(
                order.getOrDefault(bName, 0),
                order.getOrDefault(aName, 0)
        );
    }

    private VideoInfoEntity getVideoTrackForResolution(VideoInfoEntity originalTrack, String resolutionName) {
        // This method would adjust video track properties based on resolution
        // For now, return the original track
        return originalTrack;
    }

    private HLSContentEntity saveHLSContent(MediaFileInfoEntity mediaInfo,
                                            MediaFileDetails fileDetails,
                                            Path outputFolder,
                                            VideoInfoEntity videoTrack) throws IOException {

        // Check if already exists by recordId and mediaFileId
        Optional<HLSContentEntity> existing = hlsContentRepository
                .findByRecordIdAndMediaFileInfoId(fileDetails.getRecordId(), mediaInfo.getId());

        if (existing.isPresent()) {
            return updateExistingHLS(existing.get(), outputFolder, videoTrack);
        }

        // Create new HLS content
        HLSContentEntity hlsContent = new HLSContentEntity();
        hlsContent.setMediaFileInfo(mediaInfo);
        hlsContent.setRecordId(fileDetails.getRecordId());
        hlsContent.setBaseHlsPath(outputFolder.getParent().toString());

        // Master playlist path
        Path masterPlaylist = outputFolder.getParent().resolve("master.m3u8");
        hlsContent.setMasterPlaylistPath(masterPlaylist.toString());

        hlsContent.setStatus(HLSStatus.READY);
        hlsContent.setGeneratedAt(LocalDateTime.now());
        hlsContent.setSegmentDuration(segmentDuration);
        hlsContent.setTotalSegments(countSegments(outputFolder));

        // Generate playback URL
        String playbackUrl = generatePlaybackUrl(fileDetails.getRecordId());
        hlsContent.setPlaybackUrl(playbackUrl);

        hlsContent = hlsContentRepository.save(hlsContent);

        // Save variant info
        saveHLSVariant(hlsContent, outputFolder, videoTrack);

        log.info("Saved HLS content for record {}: {}", fileDetails.getRecordId(), hlsContent.getId());

        return hlsContent;
    }

    private void saveHLSVariant(HLSContentEntity hlsContent, Path variantFolder,
                                VideoInfoEntity videoTrack) throws IOException {

        String resolutionName = variantFolder.getFileName().toString();

        // Check if variant already exists
        Optional<HLSVariantEntity> existingVariant = hlsVariantRepository
                .findByHlsContentIdAndResolutionName(hlsContent.getId(), resolutionName);

        HLSVariantEntity variant;
        if (existingVariant.isPresent()) {
            variant = existingVariant.get();
            log.info("Updating existing variant: {}", resolutionName);
        } else {
            variant = new HLSVariantEntity();
            variant.setHlsContent(hlsContent);
            variant.setResolutionName(resolutionName);
            log.info("Creating new variant: {}", resolutionName);
        }

        variant.setWidth(videoTrack.getWidth());
        variant.setHeight(videoTrack.getHeight());
        variant.setCodec(videoTrack.getFormat());
        variant.setBitrate(videoTrack.getBitRate() != null ?
                videoTrack.getBitRate().longValue() : null);
        variant.setHlsPath(variantFolder.resolve("index.m3u8").toString());
        variant.setSegmentCount(countSegments(variantFolder));
        variant.setAddedAt(LocalDateTime.now());

        // Generate playlist URL
        String playlistUrl = String.format("%s/stream/%s/%s/{filename}",
                hlsBaseUrl,
                hlsContent.getRecordId(),
                resolutionName);
        variant.setPlaylistUrl(playlistUrl);

        hlsVariantRepository.save(variant);
        log.info("Saved variant {} for HLS content {}", resolutionName, hlsContent.getId());
    }

    private String generatePlaybackUrl(Long recordId) {
        return String.format("%s%s/playback/%s", hlsBaseUrl, streamingBasePath, recordId);
    }

    private HLSContentEntity updateExistingHLS(HLSContentEntity existingHLS,
                                               Path newVariantFolder,
                                               VideoInfoEntity videoTrack) throws IOException {

        log.info("Updating existing HLS content with new variant: {}",
                newVariantFolder.getFileName().toString());

        // Get resolution name from folder
        String resolutionName = newVariantFolder.getFileName().toString();

        // Check if this resolution already exists
        if (existingHLS.getVariants() != null) {
            boolean variantExists = existingHLS.getVariants().stream()
                    .anyMatch(v -> resolutionName.equals(v.getResolutionName()));

            if (variantExists) {
                log.info("Variant {} already exists, updating...", resolutionName);
                // Find and update the existing variant
                for (HLSVariantEntity variant : existingHLS.getVariants()) {
                    if (resolutionName.equals(variant.getResolutionName())) {
                        variant.setWidth(videoTrack.getWidth());
                        variant.setHeight(videoTrack.getHeight());
                        variant.setCodec(videoTrack.getFormat());
                        variant.setBitrate(videoTrack.getBitRate() != null ?
                                videoTrack.getBitRate().longValue() : null);
                        variant.setHlsPath(newVariantFolder.resolve("index.m3u8").toString());
                        variant.setSegmentCount(countSegments(newVariantFolder));
                        variant.setAddedAt(LocalDateTime.now());

                        // Update playlist URL
                        String playlistUrl = String.format("%s/stream/%s/%s/{filename}",
                                hlsBaseUrl,
                                existingHLS.getRecordId(),
                                variant.getResolutionName());
                        variant.setPlaylistUrl(playlistUrl);
                        break;
                    }
                }
            } else {
                log.info("Adding new variant: {}", resolutionName);
                // Create new variant
                saveHLSVariant(existingHLS, newVariantFolder, videoTrack);
            }
        } else {
            // No variants exist yet, create first one
            log.info("Creating first variant: {}", resolutionName);
            saveHLSVariant(existingHLS, newVariantFolder, videoTrack);
        }

        // Update master playlist path
        Path masterPlaylistPath = newVariantFolder.getParent().resolve("master.m3u8");
        if (Files.exists(masterPlaylistPath)) {
            existingHLS.setMasterPlaylistPath(masterPlaylistPath.toString());
        }

        // Update timestamp and status
        existingHLS.setGeneratedAt(LocalDateTime.now());
        existingHLS.setStatus(HLSStatus.READY);

        // Save and return
        return hlsContentRepository.save(existingHLS);
    }

    // New methods for enhanced functionality

    /**
     * Get HLS content info for a record
     */
    public Optional<HLSDto.HLSContentResponse> getHLSContentInfo(Long recordId) {
        List<HLSContentEntity> hlsContents = hlsContentRepository.findAllByRecordId(recordId);
        if (hlsContents.isEmpty()) {
            return Optional.empty();
        }

        HLSContentEntity hlsContent = hlsContents.get(0);
        HLSDto.HLSContentResponse response = new HLSDto.HLSContentResponse();

        response.setRecordId(recordId);
        response.setMediaFileId(hlsContent.getMediaFileInfo().getId());
        response.setStatus(hlsContent.getStatus());
        response.setGeneratedAt(hlsContent.getGeneratedAt());
        response.setPlaybackUrl(hlsContent.getPlaybackUrl());

        // Get all variants
        List<HLSVariantEntity> variants = hlsVariantRepository
                .findByHlsContentId(hlsContent.getId());

        List<HLSDto.VariantInfo> variantInfos = variants.stream()
                .map(v -> {
                    HLSDto.VariantInfo vi = new HLSDto.VariantInfo();
                    vi.setResolution(v.getResolutionName());
                    vi.setWidth(v.getWidth());
                    vi.setHeight(v.getHeight());
                    vi.setBitrate(v.getBitrate());
                    vi.setPlaylistUrl(v.getPlaylistUrl());
                    return vi;
                })
                .collect(Collectors.toList());

        response.setVariants(variantInfos);

        return Optional.of(response);
    }

    /**
     * Get processing progress for a record
     */
    public HLSProcessingProgress getProcessingProgress(Long recordId) {
        return processingProgressMap.getOrDefault(recordId,
                new HLSProcessingProgress(recordId, HLSStatus.NOT_FOUND, "No processing in progress"));
    }

    /**
     * Check if HLS is available for a record
     */
    public boolean isHLSAvailable(Long recordId) {
        return hlsContentRepository.findAllByRecordId(recordId)
                .stream()
                .anyMatch(content -> content.getStatus() == HLSStatus.READY ||
                        content.getStatus() == HLSStatus.COMPLETED);
    }

    /**
     * Get all HLS content for a record
     */
    public List<HLSContentEntity> getHLSContentsByRecordId(Long recordId) {
        return hlsContentRepository.findAllByRecordId(recordId);
    }

    /**
     * Delete HLS content for a record
     */
    @Transactional
    public boolean deleteHLSContent(Long recordId) {
        try {
            List<HLSContentEntity> contents = hlsContentRepository.findAllByRecordId(recordId);
            if (contents.isEmpty()) {
                return false;
            }

            for (HLSContentEntity content : contents) {
                // Delete variants first
                hlsVariantRepository.deleteByHlsContentId(content.getId());

                // Delete playback sessions
                hlsPlaybackSessionRepository.deleteByHlsContentId(content.getId());

                // Delete the content
                hlsContentRepository.delete(content);

                // Delete files from disk
                deleteHLSFiles(content.getBaseHlsPath());
            }

            return true;
        } catch (Exception e) {
            log.error("Failed to delete HLS content for record {}", recordId, e);
            return false;
        }
    }

    private void deleteHLSFiles(String baseHlsPath) {
        try {
            Path basePath = Paths.get(baseHlsPath);
            if (Files.exists(basePath)) {
                Files.walk(basePath)
                        .sorted(Comparator.reverseOrder())
                        .map(Path::toFile)
                        .forEach(file -> {
                            if (!file.delete()) {
                                log.warn("Failed to delete file: {}", file.getAbsolutePath());
                            }
                        });
                log.info("Deleted HLS files from: {}", baseHlsPath);
            }
        } catch (Exception e) {
            log.error("Failed to delete HLS files from {}", baseHlsPath, e);
        }
    }

    /**
     * Cleanup old HLS content
     */
    @Scheduled(fixedDelay = 3600000) // Run every hour
    public void cleanupOldHLS() {
        if (!cleanupEnabled) {
            return;
        }

        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(cleanupOlderThanDays);
        List<HLSContentEntity> oldContents = hlsContentRepository
                .findByGeneratedAtBefore(cutoffDate);

        for (HLSContentEntity content : oldContents) {
            try {
                log.info("Cleaning up old HLS content: {}", content.getId());
                deleteHLSContent(content.getRecordId());
            } catch (Exception e) {
                log.error("Failed to cleanup HLS content {}", content.getId(), e);
            }
        }
    }

    /**
     * Generate multiple resolutions for a media file
     */
    public HLSProcessingResult generateMultipleResolutions(MediaFileInfoEntity mediaInfo,
                                                           MediaFileDetails fileDetails,
                                                           List<String> resolutions) {
        // This method would generate multiple resolutions concurrently
        // For now, just process the original resolution
        return processMediaFile(mediaInfo, fileDetails);
    }

    /**
     * Update progress from FFmpeg time output
     */
    private void updateProgressFromTime(String timeStr, Path sourcePath) {
        try {
            // Parse HH:MM:SS.mmm format
            String[] parts = timeStr.split(":");
            double hours = Double.parseDouble(parts[0]);
            double minutes = Double.parseDouble(parts[1]);
            double seconds = Double.parseDouble(parts[2].split("\\.")[0]);

            double currentSeconds = hours * 3600 + minutes * 60 + seconds;

            // Estimate total duration (this would need to be calculated properly)
            double estimatedTotalSeconds = 3600; // Default 1 hour

            int progress = (int) ((currentSeconds / estimatedTotalSeconds) * 100);
            progress = Math.min(progress, 100);

            // Update progress for all records processing this file
            int finalProgress = progress;
            processingProgressMap.values().stream()
                    .filter(p -> p.getProgress() < finalProgress)
                    .forEach(p -> p.setProgress(finalProgress));

        } catch (Exception e) {
            log.debug("Failed to parse time string: {}", timeStr, e);
        }
    }

    private void scheduleProgressCleanup(Long recordId) {
//        executorService.schedule(() -> {
//            processingProgressMap.remove(recordId);
//        }, 5, TimeUnit.MINUTES);
    }


    @Getter
    public static class HLSProcessingProgress {
        // Getters and setters
        private Long recordId;
        private String mediaFileId;
        private HLSStatus status;
        private String currentStep;
        private int progress;
        private String errorMessage;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        @Setter
        private LocalDateTime lastUpdated;

        public HLSProcessingProgress() {
            this.lastUpdated = LocalDateTime.now();
        }

        public HLSProcessingProgress(Long recordId, HLSStatus status, String currentStep) {
            this.recordId = recordId;
            this.status = status;
            this.currentStep = currentStep;
            this.progress = 0;
            this.startTime = LocalDateTime.now();
            this.lastUpdated = LocalDateTime.now();
        }

        public void setRecordId(Long recordId) {
            this.recordId = recordId;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setMediaFileId(String mediaFileId) {
            this.mediaFileId = mediaFileId;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setStatus(HLSStatus status) {
            this.status = status;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setCurrentStep(String currentStep) {
            this.currentStep = currentStep;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setProgress(int progress) {
            this.progress = Math.min(100, Math.max(0, progress));
            this.lastUpdated = LocalDateTime.now();
        }

        public void setErrorMessage(String errorMessage) {
            this.errorMessage = errorMessage;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setStartTime(LocalDateTime startTime) {
            this.startTime = startTime;
            this.lastUpdated = LocalDateTime.now();
        }

        public void setEndTime(LocalDateTime endTime) {
            this.endTime = endTime;
            this.lastUpdated = LocalDateTime.now();
        }

    }
}