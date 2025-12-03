package com.db.dbworld.services.media;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.db.dbworld.utils.MediaInfoUtils;
import jakarta.persistence.EntityManager;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Log4j2
@Service
public class MediaInfoCommandService {

    private static final String LANG_HINDI = "hi";
    private static final String LANG_GUJRATI = "gu";
    private static final String LANG_ENGLISH = "en";
    private static final String LANG_UND = "und"; // undefined

    @Autowired
    private SpokenLanguageRepository spokenLanguageRepository;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private MediaInfoUtils mediaInfoUtils;

    @Autowired
    private EntityManager entityManager;

    /**
     * Runs MediaInfo command to get media file metadata in JSON format
     */
    public String runMediaInfoCommand(Path path) {
        log.info("Starting MediaInfo command execution for path: {}", path);
        long startTime = System.currentTimeMillis();

        try {
            List<String> command = Arrays.asList(
                    DbWorldConstants.MEDIAINFO,
                    "--output=JSON",
                    path.toString()
            );

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            Process process = processBuilder.start();
            log.info("MediaInfo command constructed: {}", String.join(" ", command));
            log.info("Process builder directory: {}", processBuilder.directory());
            log.info("Process builder environment: {}", processBuilder.environment());

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                StringBuilder output = new StringBuilder();
                String line;
                log.info("Starting to read MediaInfo output...");
                int lineCount = 0;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                    lineCount++;
                    if (log.isTraceEnabled()) {
                        log.trace("MediaInfo output line {}: {}", lineCount, line);
                    }
                }
                log.info("Finished reading MediaInfo output. Total lines: {}", lineCount);

                int exitCode = process.waitFor();
                log.info("MediaInfo process completed with exit code: {}", exitCode);

                if (exitCode != 0) {
                    log.warn("MediaInfo process exited with non-zero code: {}", exitCode);
                }

                String result = output.toString();
                log.info("MediaInfo raw output length: {} characters", result.length());
                log.info("MediaInfo command execution completed successfully in {} ms",
                        System.currentTimeMillis() - startTime);
                return result;
            }
        } catch (Exception e) {
            log.error("Error while running mediainfo command for path: {}", path, e);
            throw new DbWorldException("Error while running mediainfo command: " + e.getMessage(), e);
        }
    }

    /**
     * Runs MediaInfo command with optional title modification and track filtering
     */
    public String runMediaInfoCommand(Path path, boolean modifyTitles, MediaFileDetails fileDetails) {
        log.info("Starting enhanced MediaInfo command execution with modifyTitles: {}, fileDetails: {}",
                modifyTitles, fileDetails != null ? fileDetails.getName() : "null");
        long startTime = System.currentTimeMillis();

        try {
            log.info("Step 1: Running initial MediaInfo command");
            String initialJson = runMediaInfoCommand(path);
            log.info("Initial MediaInfo JSON obtained, length: {}", initialJson.length());

            log.info("Step 2: Parsing MediaInfo JSON");
            List<MediaFileInfoEntity> mediaFileInfos = mediaInfoUtils.parseMediaInfoJson(fileDetails, initialJson);
            if (mediaFileInfos.isEmpty()) {
                log.warn("No MediaFileInfoEntity parsed from JSON");
                return initialJson;
            }

            MediaFileInfoEntity mediaFileInfo = mediaFileInfos.get(0);
            log.info("MediaFileInfoEntity parsed successfully with {} tracks",
                    mediaFileInfo.getTrackInfos().size());

            if (modifyTitles && fileDetails != null) {
                log.info("Step 3: Title modification requested, generating modifications");
                Map<String, String> titleModifications = generateTitleModifications(mediaFileInfo, fileDetails);
                log.info("Generated {} title modifications", titleModifications.size());

                if (!titleModifications.isEmpty()) {
                    log.info("Step 4: Applying title modifications and track filtering");
                    modifyMediaTitles(path, titleModifications, mediaFileInfo, fileDetails);
//                    log.info("Step 5: Renaming file with standardized name");
//                    renameFileWithStandardizedName(path, fileDetails, mediaFileInfo);
                } else {
                    log.info("No title modifications generated, skipping modification step");
                }
            } else {
                log.info("Title modification not requested or fileDetails is null, skipping modification");
            }

            entityManager.detach(mediaFileInfo);
//            entityManager.clear();

            log.info("Step 6: Running final MediaInfo command after modifications");
            String finalJson = runMediaInfoCommand(path);
            log.info("Enhanced MediaInfo command execution completed successfully in {} ms",
                    System.currentTimeMillis() - startTime);
            return finalJson;
        } catch (Exception e) {
            entityManager.clear();
            log.error("Error while running enhanced mediainfo command for path: {}", path, e);
            throw new DbWorldException("Error while running mediainfo command: " + e.getMessage(), e);
        }
    }

    /**
     * Renames file with standardized naming convention
     */
    private void renameFileWithStandardizedName(Path path, MediaFileDetails fileDetails, MediaFileInfoEntity mediaFileInfo) {
        log.info("Starting file rename operation for: {}", path);
        long startTime = System.currentTimeMillis();

        try {
            log.info("Building new filename using mediaInfoUtils");
            String newFilename = mediaInfoUtils.buildFileNameAndPath(fileDetails, mediaFileInfo);
            log.info("New filename generated: {}", newFilename);

            Path newPath = path.resolveSibling(newFilename);
            log.info("Attempting to rename file from {} to {}", path, newPath);

            dbWorldUtils.moveFileOrDir(path.toString(), newPath.toString(), true);
            log.info("File renamed successfully: {} → {} in {} ms",
                    path, newPath, System.currentTimeMillis() - startTime);
        } catch (Exception e) {
            log.warn("Failed to rename file: {} - Error: {}", path, e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Generates title modifications based on MediaFileInfoEntity and file details
     */
    private Map<String, String> generateTitleModifications(MediaFileInfoEntity mediaFileInfo, MediaFileDetails fileDetails) {
        log.info("Starting title modifications generation for: {}",
                fileDetails != null ? fileDetails.getName() : "unknown");
        long startTime = System.currentTimeMillis();
        Map<String, String> modifications = new HashMap<>();

        try {
            log.info("Step 1: Generating general title");
            modifications.put("general", generateGeneralTitle(fileDetails));
            log.info("General title generated: {}", modifications.get("general"));

            log.info("Step 2: Finding and processing video track");
            findAndProcessVideoTrack(mediaFileInfo, modifications);
            log.info("Video title generated: {}", modifications.get("video"));

            log.info("Step 3: Processing audio tracks");
            processAudioTracks(mediaFileInfo, modifications);
            log.info("Generated {} audio track modifications",
                    modifications.keySet().stream().filter(k -> k.startsWith("audio_")).count());

            log.info("Step 4: Processing subtitle tracks");
            processSubtitleTracks(mediaFileInfo, modifications);
            log.info("Generated {} subtitle track modifications",
                    modifications.keySet().stream().filter(k -> k.startsWith("subtitle_id_")).count());

            log.info("Title modifications generation completed. Total modifications: {} in {} ms",
                    modifications.size(), System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.warn("Failed to generate title modifications: {}", e.getMessage(), e);
        }

        return modifications;
    }

    private String generateGeneralTitle(MediaFileDetails fileDetails) {
        log.info("Generating general title for recordType: {}",
                fileDetails != null ? fileDetails.getRecordType() : "null");

        if (fileDetails == null) {
            log.warn("FileDetails is null, returning empty title");
            return "";
        }

        String title;
        if ("series".equalsIgnoreCase(fileDetails.getRecordType().name())) {
            String season = StringUtils.hasText(fileDetails.getSeason()) ? fileDetails.getSeason() : "S01";
            String episode = StringUtils.hasText(fileDetails.getEpisode()) ? fileDetails.getEpisode() : "E01";
            title = String.format("%s %s%s", fileDetails.getName(), season, episode);
            log.info("Series title generated: {}", title);
        } else {
            String year = StringUtils.hasText(fileDetails.getYear()) ? fileDetails.getYear() : "";
            title = year.isEmpty() ? fileDetails.getName() : String.format("%s (%s)", fileDetails.getName(), year);
            log.info("Movie title generated: {}", title);
        }
        return title;
    }

    private void findAndProcessVideoTrack(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.info("Searching for video track in {} tracks",
                mediaFileInfo.getTrackInfos().size());

        boolean videoTrackFound = false;
        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if ("Video".equals(track.getType())) {
                log.info("Video track found at index: {}", mediaFileInfo.getTrackInfos().indexOf(track));
                modifications.put("video", generateVideoTitle(track));
                videoTrackFound = true;
                break;
            }
        }

        if (!videoTrackFound) {
            log.warn("No video track found in media file");
        }
    }

    private String generateVideoTitle(TrackInfoEntity track) {
        log.info("Generating video title for track: {}", track);
        List<String> titleParts = new ArrayList<>();

        if (track instanceof VideoInfoEntity videoInfoTrack) {
            log.info("Processing VideoInfoEntity for title generation");
            if (videoInfoTrack.getFormat() != null) {
                titleParts.add(videoInfoTrack.getFormat());
                log.trace("Added format: {}", videoInfoTrack.getFormat());
            }
            if (videoInfoTrack.getFormatProfile() != null) {
                titleParts.add(videoInfoTrack.getFormatProfile());
                log.trace("Added format profile: {}", videoInfoTrack.getFormatProfile());
            }
            if (videoInfoTrack.getBitDepth() != null) {
                titleParts.add(videoInfoTrack.getBitDepth() + "bit");
                log.trace("Added bit depth: {}bit", videoInfoTrack.getBitDepth());
            }
            if (videoInfoTrack.getHeight() != null) {
                titleParts.add(videoInfoTrack.getHeight() + "p");
                log.trace("Added height: {}p", videoInfoTrack.getHeight());
            }
        } else {
            log.warn("Track is not a VideoInfoEntity, type: {}", track.getType());
        }

        String title = String.join(" ", titleParts).trim();
        log.info("Generated video title: '{}' from {} parts", title, titleParts.size());
        return title.isEmpty() ? "Main Video" : title;
    }

//    private void processAudioTracks(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
//        log.info("Processing audio tracks from {} total tracks",
//                mediaFileInfo.getTrackInfos().size());
//
//        int audioIndex = 0;
//        int audioTrackCount = 0;
//
//        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
//            if (track instanceof AudioInfoEntity || "Audio".equalsIgnoreCase(track.getType())) {
//                log.info("Audio track found at position {}, generating title", audioIndex);
//                String audioTitle = generateAudioTitle((AudioInfoEntity) track);
//                modifications.put("audio_" + audioIndex, audioTitle);
//                log.info("Audio track {} title: {}", audioIndex, audioTitle);
//                audioIndex++;
//                audioTrackCount++;
//            }
//        }
//
//        log.info("Processed {} audio tracks", audioTrackCount);
//    }

    private void processAudioTracks(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.info("Processing audio tracks from {} total tracks",
                mediaFileInfo.getTrackInfos().size());

        // Get the audio tracks to keep based on your filtering rules
        Set<Integer> audioTracksToKeep = getAudioTracksToKeep(mediaFileInfo.getTrackInfos());
        log.info("Audio tracks to keep: {}", audioTracksToKeep);

        int audioIndex = 0;
        int audioTrackCount = 0;
        int currentAudioPosition = 0;

        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if (track instanceof AudioInfoEntity || "Audio".equalsIgnoreCase(track.getType())) {
                // Only process tracks that are in the keep set
                if (audioTracksToKeep.contains(currentAudioPosition)) {
                    log.info("Audio track found at position {} (original index {}), generating title",
                            audioIndex, currentAudioPosition);
                    String audioTitle = generateAudioTitle((AudioInfoEntity) track);

                    // Use the ORIGINAL track index, not the sequential index
                    modifications.put("audio_" + currentAudioPosition, audioTitle);
                    log.info("Audio track {} (original index {}) title: {}",
                            audioIndex, currentAudioPosition, audioTitle);
                    audioIndex++;
                    audioTrackCount++;
                } else {
                    log.info("Skipping audio track at original position {} (not in keep set)",
                            currentAudioPosition);
                }
                currentAudioPosition++;
            }
        }

        log.info("Processed {} audio tracks (filtered from {} total audio tracks)",
                audioTrackCount, currentAudioPosition);
    }

    private String generateAudioTitle(AudioInfoEntity audioInfoTrack) {
        log.info("Generating audio title for track: {}", audioInfoTrack);
        List<String> titleParts = new ArrayList<>();

        log.info("Processing AudioInfoEntity for title generation");
        String language = audioInfoTrack.getLanguage() != null ? getLanguageName(audioInfoTrack.getLanguage()) : "";
        if (!language.isEmpty()) {
            titleParts.add(language);
            log.trace("Added language: {}", language);
        }
        if (audioInfoTrack.getFormat() != null) {
            titleParts.add(audioInfoTrack.getFormat());
            log.trace("Added format: {}", audioInfoTrack.getFormat());
        }
        if (audioInfoTrack.getChannels() != null) {
            titleParts.add(audioInfoTrack.getChannels() + "ch");
            log.trace("Added channels: {}ch", audioInfoTrack.getChannels());
        }
        if (audioInfoTrack.getBitRate() != null) {
            String formattedBitrate = formatBitrate(String.valueOf(audioInfoTrack.getBitRate()));
            titleParts.add(formattedBitrate);
            log.trace("Added bitrate: {}", formattedBitrate);
        }

        String title = String.join(" ", titleParts).trim();
        log.info("Generated audio title: '{}' from {} parts", title, titleParts.size());
        return title;
    }

    private void processSubtitleTracks(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.info("Processing subtitle tracks from {} total tracks",
                mediaFileInfo.getTrackInfos().size());

        int subtitleIndex = 0;
        int subtitleTrackCount = 0;

        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if ("Text".equals(track.getType())) {
                log.info("Subtitle track found at position {}, generating title", subtitleIndex);
                String subtitleTitle = generateSubtitleTitle(track);
                modifications.put("subtitle_id_" + subtitleIndex, subtitleTitle);
                log.info("Subtitle track {} title: {}", subtitleIndex, subtitleTitle);
                subtitleIndex++;
                subtitleTrackCount++;
            }
        }

        log.info("Processed {} subtitle tracks", subtitleTrackCount);
    }

    private String generateSubtitleTitle(TrackInfoEntity track) {
        log.info("Generating subtitle title for track: {}", track);

        if (track instanceof TextInfoEntity textInfoTrack) {
            log.info("Processing TextInfoEntity for subtitle title generation");
            String language = textInfoTrack.getLanguage() != null ? getLanguageName(textInfoTrack.getLanguage()) : "";
            String format = textInfoTrack.getFormat() != null ? textInfoTrack.getFormat() : "";
            String existingTitle = textInfoTrack.getTitle() != null ? textInfoTrack.getTitle() : "";
            boolean forced = textInfoTrack.getForced() != null && "Yes".equals(textInfoTrack.getForced());

            log.info("Subtitle properties - language: {}, format: {}, existingTitle: {}, forced: {}",
                    language, format, existingTitle, forced);

            String title;
            if (StringUtils.hasText(existingTitle) && !"SDH".equals(existingTitle)) {
                title = String.format("%s %s", language, existingTitle);
                log.info("Using existing title with language: {}", title);
            } else if (forced) {
                title = String.format("%s %s [Forced]", language, format);
                log.info("Generated forced subtitle title: {}", title);
            } else if ("SDH".equals(existingTitle)) {
                title = String.format("%s SDH", language);
                log.info("Generated SDH subtitle title: {}", title);
            } else {
                title = String.format("%s %s", language, format);
                log.info("Generated basic subtitle title: {}", title);
            }
            return title;
        } else {
            log.warn("Track is not a TextInfoEntity, type: {}", track.getType());
            return "";
        }
    }

    private String formatBitrate(String bitrate) {
        log.info("Formatting bitrate: {}", bitrate);
        try {
            int bitrateValue = Integer.parseInt(bitrate);
            String formatted;
            if (bitrateValue >= 1_000_000) {
                formatted = String.format("%.1f Mbps", bitrateValue / 1_000_000.0);
            } else if (bitrateValue >= 1000) {
                formatted = String.format("%d kbps", bitrateValue / 1000);
            } else {
                formatted = bitrate + " bps";
            }
            log.info("Formatted bitrate: {} -> {}", bitrate, formatted);
            return formatted;
        } catch (NumberFormatException e) {
            log.warn("Failed to parse bitrate: {}, returning original", bitrate, e);
            return bitrate;
        }
    }

    private String getLanguageName(String languageCode) {
        log.info("Looking up language name for code: {}", languageCode);
        if (!StringUtils.hasText(languageCode)) {
            log.warn("Empty language code provided");
            return languageCode;
        }

        try {
            return spokenLanguageRepository.findById(languageCode)
                    .map(entity -> {
                        String name = StringUtils.hasText(entity.getName()) ?
                                entity.getName() : entity.getEnglish_name();
                        log.info("Found language name: {} for code: {}", name, languageCode);
                        return name;
                    })
                    .orElseGet(() -> {
                        log.warn("Language code not found in repository: {}", languageCode);
                        return languageCode;
                    });
        } catch (Exception e) {
            log.error("Error looking up language code: {}", languageCode, e);
            return languageCode;
        }
    }

    /**
     * Modifies media file titles and filters tracks using FFmpeg
     */
    private void modifyMediaTitles(Path inputPath, Map<String, String> titleModifications,
                                   MediaFileInfoEntity mediaFileInfo, MediaFileDetails fileDetails) {
        log.info("Starting media title modification for: {}", inputPath);
        long startTime = System.currentTimeMillis();
        Path tempOutput = null;

        try {
            if (titleModifications.isEmpty()) {
                log.info("No title modifications specified for file: {}", inputPath);
                return;
            }

            log.info("Title modifications to apply: {}", titleModifications);

            if (!Files.exists(inputPath)) {
                throw new DbWorldException("Input file does not exist: " + inputPath);
            }

            log.info("Creating temporary output file");
            tempOutput = Files.createTempFile(inputPath.getParent(), "modified_", ".mkv");
            log.info("Temporary file created: {}", tempOutput);

            log.info("Building FFmpeg command");
            List<String> command = buildFfmpegCommand(inputPath, tempOutput, titleModifications, mediaFileInfo.getTrackInfos());
            log.info("FFmpeg command built with {} arguments", command.size());

            log.info("Executing FFmpeg command");
            executeFfmpegCommand(command, inputPath, tempOutput);

            log.info("Successfully modified media titles and filtered tracks for: {} in {} ms",
                    inputPath, System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.error("Error modifying media titles for file: {}", inputPath, e);
            cleanupTempFile(tempOutput);
            throw new DbWorldException("Error modifying media titles for file: " + inputPath, e);
        }
    }

    private void cleanupTempFile(Path tempOutput) {
        if (tempOutput != null) {
            try {
                log.info("Attempting to clean up temporary file: {}", tempOutput);
                boolean deleted = Files.deleteIfExists(tempOutput);
                if (deleted) {
                    log.info("Temporary file deleted successfully: {}", tempOutput);
                } else {
                    log.info("Temporary file did not exist or could not be deleted: {}", tempOutput);
                }
            } catch (IOException e) {
                log.warn("Failed to delete temporary file: {}", tempOutput, e);
            }
        } else {
            log.info("No temporary file to clean up");
        }
    }

    private List<String> buildFfmpegCommand(Path inputPath, Path outputPath,
                                            Map<String, String> titleModifications,
                                            List<TrackInfoEntity> trackInfoEntities) {
        log.info("Building FFmpeg command for input: {}, output: {}", inputPath, outputPath);
        List<String> command = new ArrayList<>();
        command.add("ffmpeg");
        command.add("-i");
        command.add(inputPath.toString());
        log.info("Added input parameter: {}", inputPath);

        log.info("Adding track filtering maps");
        addTrackFilteringMaps(command, trackInfoEntities);

        command.add("-c");
        command.add("copy");
        log.info("Added copy codec parameter");

        log.info("Adding metadata flags");
        addMetadataFlags(command, titleModifications, trackInfoEntities); // Pass trackInfoEntities here

        command.add("-y");
        command.add(outputPath.toString());
        log.info("Added output parameter: {}", outputPath);

        log.info("FFmpeg command built with {} arguments", command.size());
        if (log.isDebugEnabled()) {
            log.info("Full FFmpeg command: {}", String.join(" ", command));
        }

        return command;
    }

    private void addMetadataFlags(List<String> command, Map<String, String> titleModifications,
                                  List<TrackInfoEntity> trackInfoEntities) {
        log.info("Adding metadata flags for {} modifications", titleModifications.size());

        Set<Integer> audioTracksToKeep = getAudioTracksToKeep(trackInfoEntities);

        addMetadataFlagIfPresent(command, "general", "title", titleModifications);
        addMetadataFlagIfPresent(command, "video", "s:v:0", "title", titleModifications);
        addAudioMetadataFlags(command, titleModifications, audioTracksToKeep);
        addSubtitleMetadataFlags(command, titleModifications);

        log.info("Metadata flags added successfully");
    }

    private void addMetadataFlagIfPresent(List<String> command, String modificationKey,
                                          String ffmpegFlag, Map<String, String> titleModifications) {
        if (titleModifications.containsKey(modificationKey)) {
            String value = titleModifications.get(modificationKey);
            command.add("-metadata");
            command.add(ffmpegFlag + "=" + value);
            log.info("Added metadata flag for {}: {}", modificationKey, value);
        } else {
            log.trace("Modification key not found: {}", modificationKey);
        }
    }

    private void addMetadataFlagIfPresent(List<String> command, String modificationKey,
                                          String streamType, String valueKey,
                                          Map<String, String> titleModifications) {
        if (titleModifications.containsKey(modificationKey)) {
            String value = titleModifications.get(modificationKey);
            command.add("-metadata:" + streamType);
            command.add(valueKey + "=" + value);
            log.info("Added metadata flag for {}:{}: {}", streamType, modificationKey, value);
        } else {
            log.trace("Modification key not found: {}", modificationKey);
        }
    }

    private void addAudioMetadataFlags(List<String> command, Map<String, String> titleModifications,
                                       Set<Integer> audioTracksToKeep) {
        log.info("Adding audio metadata flags for {} tracks to keep", audioTracksToKeep.size());
        int audioFlagCount = 0;

        // Sort the tracks to maintain consistent order with mapping
        List<Integer> sortedTracks = audioTracksToKeep.stream()
                .sorted().collect(Collectors.toList());

        // Create mapping from original index to new sequential index
        Map<Integer, Integer> originalToNewIndexMap = new HashMap<>();
        for (int i = 0; i < sortedTracks.size(); i++) {
            originalToNewIndexMap.put(sortedTracks.get(i), i);
        }

        for (Map.Entry<String, String> entry : titleModifications.entrySet()) {
            if (entry.getKey().startsWith("audio_")) {
                String originalIndexStr = entry.getKey().replace("audio_", "");
                try {
                    int originalIndex = Integer.parseInt(originalIndexStr);
                    Integer newSequentialIndex = originalToNewIndexMap.get(originalIndex);

                    if (newSequentialIndex != null) {
                        command.add("-metadata:s:a:" + newSequentialIndex);
                        command.add("title=" + entry.getValue());
                        audioFlagCount++;
                        log.info("Added audio metadata for track {} (original {}): {}",
                                newSequentialIndex, originalIndex, entry.getValue());
                    } else {
                        log.warn("Original audio index {} not found in tracks to keep", originalIndex);
                    }
                } catch (NumberFormatException e) {
                    log.warn("Invalid audio index format: {}", originalIndexStr, e);
                }
            }
        }

        log.info("Added {} audio metadata flags", audioFlagCount);
    }

    private void addSubtitleMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        log.info("Adding subtitle metadata flags");
        int subtitleFlagCount = 0;

        for (Map.Entry<String, String> entry : titleModifications.entrySet()) {
            if (entry.getKey().startsWith("subtitle_id_")) {
                String subtitleIndex = entry.getKey().replace("subtitle_id_", "");
                try {
                    int index = Integer.parseInt(subtitleIndex);
                    command.add("-metadata:s:s:" + index);
                    command.add("title=" + entry.getValue());
                    subtitleFlagCount++;
                    log.info("Added subtitle metadata for track {}: {}", index, entry.getValue());
                } catch (NumberFormatException e) {
                    log.warn("Invalid subtitle index format: {}", subtitleIndex, e);
                }
            }
        }

        log.info("Added {} subtitle metadata flags", subtitleFlagCount);
    }

    private void executeFfmpegCommand(List<String> command, Path inputPath, Path tempOutput)
            throws IOException, InterruptedException {
        log.info("Executing FFmpeg command for input: {}", inputPath);
        long startTime = System.currentTimeMillis();

        log.info("Full FFmpeg command: {}", String.join(" ", command));
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);

        log.info("Starting FFmpeg process");
        Process process = processBuilder.start();

        log.info("FFMPEG Command: [{}]", String.join(" ", processBuilder.command()));

        StringBuilder output = new StringBuilder();
        int lineCount = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            log.info("Reading FFmpeg output...");
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                lineCount++;
                if (log.isTraceEnabled()) {
                    log.trace("FFmpeg output line {}: {}", lineCount, line);
                }
            }
            log.info("Finished reading FFmpeg output. Total lines: {}", lineCount);
        }

        int exitCode = process.waitFor();
        long executionTime = System.currentTimeMillis() - startTime;
        log.info("FFmpeg process completed with exit code: {} in {} ms", exitCode, executionTime);

        if (exitCode != 0) {
            log.error("FFmpeg failed with exit code {}. Output: {}", exitCode, output.toString().trim());
            throw new DbWorldException(String.format(
                    "FFmpeg failed with exit code %d. Output: %s",
                    exitCode, output.toString().trim()
            ));
        }

        log.info("FFmpeg execution successful, moving temporary file to original location");
        dbWorldUtils.moveFileOrDir(tempOutput.toString(), inputPath.toString(), true);
        log.info("File modification completed successfully");
    }

    private void addTrackFilteringMaps(List<String> command, List<TrackInfoEntity> trackInfoEntities) {
        log.info("Adding track filtering maps for {} tracks", trackInfoEntities.size());

        Set<Integer> audioTracksToKeep = getAudioTracksToKeep(trackInfoEntities);
        Set<Integer> subtitleTracksToKeep = getSubtitleTracksToKeep(trackInfoEntities);

        log.info("Audio tracks to keep: {}", audioTracksToKeep);
        log.info("Subtitle tracks to keep: {}", subtitleTracksToKeep);

        addAudioMapCommand(command, audioTracksToKeep);
        addSubtitleMapCommand(command, subtitleTracksToKeep);

        // Always add video track
        command.add("-map");
        command.add("0:v");
        log.info("Added video track mapping");
    }

    private void addAudioMapCommand(List<String> command, Set<Integer> audioTracksToKeep) {
        log.info("Adding audio map command for {} tracks", audioTracksToKeep.size());

        if (!audioTracksToKeep.isEmpty()) {
            // Sort the tracks to maintain consistent order
            List<Integer> sortedTracks = audioTracksToKeep.stream()
                    .sorted()
                    .collect(Collectors.toList());

            for (int trackIndex : sortedTracks) {
                command.add("-map");
                command.add("0:a:" + trackIndex);
                log.trace("Added audio map for track index: {}", trackIndex);
            }
            log.info("Added {} specific audio track mappings in sorted order: {}",
                    sortedTracks.size(), sortedTracks);
        } else {
            command.add("-map");
            command.add("0:a");
            log.info("Added all audio tracks mapping");
        }
    }

    private void addSubtitleMapCommand(List<String> command, Set<Integer> subtitleTracksToKeep) {
        log.info("Adding subtitle map command for {} tracks", subtitleTracksToKeep.size());

        if (!subtitleTracksToKeep.isEmpty()) {
            for (int trackIndex : subtitleTracksToKeep) {
                command.add("-map");
                command.add("0:s:" + trackIndex);
                log.trace("Added subtitle map for track index: {}", trackIndex);
            }
            log.info("Added {} specific subtitle track mappings", subtitleTracksToKeep.size());
        } else {
            // Only map subtitle streams if they exist - don't force it
            // This prevents the "Stream map '' matches no streams" error
            log.info("No subtitle tracks specified, skipping subtitle mapping");
        }
    }

    private Set<Integer> getAudioTracksToKeep(List<TrackInfoEntity> trackInfoEntities) {
        log.info("Determining audio tracks to keep from {} tracks", trackInfoEntities.size());
        Map<String, List<Integer>> languageTracks = new HashMap<>();
        int audioIndex = 0;
        int audioTrackCount = 0;

        for (TrackInfoEntity track : trackInfoEntities) {
            if ("Audio".equalsIgnoreCase(track.getType())) {
                String language = extractLanguage(track);
                languageTracks.computeIfAbsent(language, k -> new ArrayList<>()).add(audioIndex);
                log.trace("Audio track {} has language: {}", audioIndex, language);
                audioIndex++;
                audioTrackCount++;
            }
        }

        log.info("Found {} audio tracks with languages: {}", audioTrackCount, languageTracks.keySet());
        Set<Integer> result = filterAudioTracksByCustomRules(languageTracks);
        log.info("Audio tracks to keep after filtering: {}", result);
        return result;
    }

    private Set<Integer> getSubtitleTracksToKeep(List<TrackInfoEntity> trackInfoEntities) {
        log.info("Determining subtitle tracks to keep from {} tracks", trackInfoEntities.size());
        Map<String, List<Integer>> languageTracks = new HashMap<>();
        int subtitleIndex = 0;
        int subtitleTrackCount = 0;

        for (TrackInfoEntity track : trackInfoEntities) {
            if ("Text".equalsIgnoreCase(track.getType())) {
                String language = extractLanguage(track);
                languageTracks.computeIfAbsent(language, k -> new ArrayList<>()).add(subtitleIndex);
                log.trace("Subtitle track {} has language: {}", subtitleIndex, language);
                subtitleIndex++;
                subtitleTrackCount++;
            }
        }

        log.info("Found {} subtitle tracks with languages: {}", subtitleTrackCount, languageTracks.keySet());
        Set<Integer> result = filterAudioTracksByCustomRules(languageTracks);
        log.info("Subtitle tracks to keep after filtering: {}", result);
        return result;
    }

    private String extractLanguage(TrackInfoEntity track) {
        String language = "und";
        if (track instanceof AudioInfoEntity audio) {
            language = audio.getLanguage() != null ? audio.getLanguage() : "und";
            log.trace("Extracted audio language: {}", language);
        } else if (track instanceof TextInfoEntity text) {
            language = text.getLanguage() != null ? text.getLanguage() : "und";
            log.trace("Extracted subtitle language: {}", language);
        } else {
            log.trace("Track type {} not handled for language extraction", track.getType());
        }
        return language;
    }


    private Set<Integer> filterAudioTracksByCustomRules(Map<String, List<Integer>> languageTracks) {
        log.info("Filtering tracks by custom rules. Language tracks: {}", languageTracks);
        long startTime = System.currentTimeMillis();
        Set<Integer> tracksToKeep = new LinkedHashSet<>();

        // --- Guard clause: null or empty map ---
        if (languageTracks == null || languageTracks.isEmpty()) {
            log.info("Language tracks is null or empty, returning empty set");
            return tracksToKeep; // nothing to keep
        }

        int total = languageTracks.values().stream().mapToInt(list -> list != null ? list.size() : 0).sum();
        log.info("Total tracks found: {}", total);

        if (total == 0) {
            log.info("No tracks present, returning empty set");
            return tracksToKeep; // no tracks present
        }

        // Filter out null or empty keys
        Set<String> langs = languageTracks.keySet().stream()
                .filter(Objects::nonNull)
                .filter(k -> !k.isBlank())
                .collect(Collectors.toSet());
        log.info("Languages after filtering: {}", langs);

        // --- If langs is empty after cleaning ---
        if (langs.isEmpty()) {
            log.info("No valid languages found, keeping all tracks");
            // We don't know the languages → safest option: keep all
            languageTracks.values().forEach(tracksToKeep::addAll);
            log.info("Tracks to keep after keeping all: {}", tracksToKeep);
            return tracksToKeep;
        }

        // --- Single audio ---
        if (total == 1) {
            log.info("Single track found, keeping it");
            languageTracks.values().forEach(tracksToKeep::addAll);
            return tracksToKeep;
        }

        // --- Dual audio ---
        if (total == 2) {
            log.info("Dual tracks found, applying dual track rules");
            if (langs.contains(LANG_HINDI) && langs.contains(LANG_ENGLISH)) {
                log.info("Hindi and English tracks found, keeping both");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
            } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI)) {
                log.info("Hindi and Gujarati tracks found, keeping both");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            } else if (langs.contains(LANG_HINDI)) {
                log.info("Only Hindi tracks found, keeping Hindi");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            } else if (langs.contains(LANG_GUJRATI) && langs.contains(LANG_UND)) {
                log.info("Gujarati and undefined tracks found, keeping Gujarati");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            } else {
                log.info("No preferred language combination found, keeping all tracks");
                languageTracks.values().forEach(tracksToKeep::addAll);
            }
            log.info("Dual track filtering result: {}", tracksToKeep);
            return tracksToKeep;
        }

        // --- Multi audio (> 2) ---
        log.info("Multi-track scenario ({} tracks), applying multi-track rules", total);
        if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI) && langs.contains(LANG_ENGLISH)) {
            log.info("Hindi, Gujarati and English tracks found, keeping all three");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
        } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_ENGLISH)) {
            log.info("Hindi and English tracks found, keeping both");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
        } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI)) {
            log.info("Hindi and Gujarati tracks found, keeping both");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
        } else if (langs.contains(LANG_HINDI)) {
            log.info("Only Hindi tracks found, keeping Hindi");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
        } else if (langs.contains(LANG_GUJRATI) && langs.contains(LANG_UND)) {
            log.info("Gujarati and undefined tracks found, keeping Gujarati");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
        } else {
            log.info("No preferred language combination found, keeping all tracks");
            languageTracks.values().forEach(tracksToKeep::addAll);
        }

        log.info("Multi-track filtering completed in {} ms. Tracks to keep: {}",
                System.currentTimeMillis() - startTime, tracksToKeep);
        return tracksToKeep;
    }
}