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
            log.debug("Process builder directory: {}", processBuilder.directory());
            log.debug("Process builder environment: {}", processBuilder.environment());

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                StringBuilder output = new StringBuilder();
                String line;
                log.debug("Starting to read MediaInfo output...");
                int lineCount = 0;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                    lineCount++;
                    if (log.isTraceEnabled()) {
                        log.trace("MediaInfo output line {}: {}", lineCount, line);
                    }
                }
                log.debug("Finished reading MediaInfo output. Total lines: {}", lineCount);

                int exitCode = process.waitFor();
                log.info("MediaInfo process completed with exit code: {}", exitCode);

                if (exitCode != 0) {
                    log.warn("MediaInfo process exited with non-zero code: {}", exitCode);
                }

                String result = output.toString();
                log.debug("MediaInfo raw output length: {} characters", result.length());
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
            log.debug("Step 1: Running initial MediaInfo command");
            String initialJson = runMediaInfoCommand(path);
            log.debug("Initial MediaInfo JSON obtained, length: {}", initialJson.length());

            log.debug("Step 2: Parsing MediaInfo JSON");
            List<MediaFileInfoEntity> mediaFileInfos = mediaInfoUtils.parseMediaInfoJson(fileDetails, initialJson);
            if (mediaFileInfos.isEmpty()) {
                log.warn("No MediaFileInfoEntity parsed from JSON");
                return initialJson;
            }

            MediaFileInfoEntity mediaFileInfo = mediaFileInfos.get(0);
            log.debug("MediaFileInfoEntity parsed successfully with {} tracks",
                    mediaFileInfo.getTrackInfos().size());

            if (modifyTitles && fileDetails != null) {
                log.info("Step 3: Title modification requested, generating modifications");
                Map<String, String> titleModifications = generateTitleModifications(mediaFileInfo, fileDetails);
                log.debug("Generated {} title modifications", titleModifications.size());

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

            log.debug("Step 6: Running final MediaInfo command after modifications");
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
            log.debug("Building new filename using mediaInfoUtils");
            String newFilename = mediaInfoUtils.buildFileNameAndPath(fileDetails, mediaFileInfo);
            log.debug("New filename generated: {}", newFilename);

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
            log.debug("Step 1: Generating general title");
            modifications.put("general", generateGeneralTitle(fileDetails));
            log.debug("General title generated: {}", modifications.get("general"));

            log.debug("Step 2: Finding and processing video track");
            findAndProcessVideoTrack(mediaFileInfo, modifications);
            log.debug("Video title generated: {}", modifications.get("video"));

            log.debug("Step 3: Processing audio tracks");
            processAudioTracks(mediaFileInfo, modifications);
            log.debug("Generated {} audio track modifications",
                    modifications.keySet().stream().filter(k -> k.startsWith("audio_")).count());

            log.debug("Step 4: Processing subtitle tracks");
            processSubtitleTracks(mediaFileInfo, modifications);
            log.debug("Generated {} subtitle track modifications",
                    modifications.keySet().stream().filter(k -> k.startsWith("subtitle_id_")).count());

            log.info("Title modifications generation completed. Total modifications: {} in {} ms",
                    modifications.size(), System.currentTimeMillis() - startTime);

        } catch (Exception e) {
            log.warn("Failed to generate title modifications: {}", e.getMessage(), e);
        }

        return modifications;
    }

    private String generateGeneralTitle(MediaFileDetails fileDetails) {
        log.debug("Generating general title for recordType: {}",
                fileDetails != null ? fileDetails.getRecordType() : "null");

        if (fileDetails == null) {
            log.warn("FileDetails is null, returning empty title");
            return "";
        }

        String title;
        if ("series".equalsIgnoreCase(fileDetails.getRecordType())) {
            String season = StringUtils.hasText(fileDetails.getSeason()) ? fileDetails.getSeason() : "S01";
            String episode = StringUtils.hasText(fileDetails.getEpisode()) ? fileDetails.getEpisode() : "E01";
            title = String.format("%s %s%s", fileDetails.getName(), season, episode);
            log.debug("Series title generated: {}", title);
        } else {
            String year = StringUtils.hasText(fileDetails.getYear()) ? fileDetails.getYear() : "";
            title = year.isEmpty() ? fileDetails.getName() : String.format("%s (%s)", fileDetails.getName(), year);
            log.debug("Movie title generated: {}", title);
        }
        return title;
    }

    private void findAndProcessVideoTrack(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.debug("Searching for video track in {} tracks",
                mediaFileInfo.getTrackInfos().size());

        boolean videoTrackFound = false;
        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if ("Video".equals(track.getType())) {
                log.debug("Video track found at index: {}", mediaFileInfo.getTrackInfos().indexOf(track));
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
        log.debug("Generating video title for track: {}", track);
        List<String> titleParts = new ArrayList<>();

        if (track instanceof VideoInfoEntity videoInfoTrack) {
            log.debug("Processing VideoInfoEntity for title generation");
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
        log.debug("Generated video title: '{}' from {} parts", title, titleParts.size());
        return title.isEmpty() ? "Main Video" : title;
    }

    private void processAudioTracks(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.debug("Processing audio tracks from {} total tracks",
                mediaFileInfo.getTrackInfos().size());

        int audioIndex = 0;
        int audioTrackCount = 0;

        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if ("Audio".equals(track.getType())) {
                log.debug("Audio track found at position {}, generating title", audioIndex);
                String audioTitle = generateAudioTitle(track);
                modifications.put("audio_" + audioIndex, audioTitle);
                log.debug("Audio track {} title: {}", audioIndex, audioTitle);
                audioIndex++;
                audioTrackCount++;
            }
        }

        log.info("Processed {} audio tracks", audioTrackCount);
    }

    private String generateAudioTitle(TrackInfoEntity track) {
        log.debug("Generating audio title for track: {}", track);
        List<String> titleParts = new ArrayList<>();

        if (track instanceof AudioInfoEntity audioInfoTrack) {
            log.debug("Processing AudioInfoEntity for title generation");
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
        } else {
            log.warn("Track is not an AudioInfoEntity, type: {}", track.getType());
        }

        String title = String.join(" ", titleParts).trim();
        log.debug("Generated audio title: '{}' from {} parts", title, titleParts.size());
        return title;
    }

    private void processSubtitleTracks(MediaFileInfoEntity mediaFileInfo, Map<String, String> modifications) {
        log.debug("Processing subtitle tracks from {} total tracks",
                mediaFileInfo.getTrackInfos().size());

        int subtitleIndex = 0;
        int subtitleTrackCount = 0;

        for (TrackInfoEntity track : mediaFileInfo.getTrackInfos()) {
            if ("Text".equals(track.getType())) {
                log.debug("Subtitle track found at position {}, generating title", subtitleIndex);
                String subtitleTitle = generateSubtitleTitle(track);
                modifications.put("subtitle_id_" + subtitleIndex, subtitleTitle);
                log.debug("Subtitle track {} title: {}", subtitleIndex, subtitleTitle);
                subtitleIndex++;
                subtitleTrackCount++;
            }
        }

        log.info("Processed {} subtitle tracks", subtitleTrackCount);
    }

    private String generateSubtitleTitle(TrackInfoEntity track) {
        log.debug("Generating subtitle title for track: {}", track);

        if (track instanceof TextInfoEntity textInfoTrack) {
            log.debug("Processing TextInfoEntity for subtitle title generation");
            String language = textInfoTrack.getLanguage() != null ? getLanguageName(textInfoTrack.getLanguage()) : "";
            String format = textInfoTrack.getFormat() != null ? textInfoTrack.getFormat() : "";
            String existingTitle = textInfoTrack.getTitle() != null ? textInfoTrack.getTitle() : "";
            boolean forced = textInfoTrack.getForced() != null && "Yes".equals(textInfoTrack.getForced());

            log.debug("Subtitle properties - language: {}, format: {}, existingTitle: {}, forced: {}",
                    language, format, existingTitle, forced);

            String title;
            if (StringUtils.hasText(existingTitle) && !"SDH".equals(existingTitle)) {
                title = String.format("%s %s", language, existingTitle);
                log.debug("Using existing title with language: {}", title);
            } else if (forced) {
                title = String.format("%s %s [Forced]", language, format);
                log.debug("Generated forced subtitle title: {}", title);
            } else if ("SDH".equals(existingTitle)) {
                title = String.format("%s SDH", language);
                log.debug("Generated SDH subtitle title: {}", title);
            } else {
                title = String.format("%s %s", language, format);
                log.debug("Generated basic subtitle title: {}", title);
            }
            return title;
        } else {
            log.warn("Track is not a TextInfoEntity, type: {}", track.getType());
            return "";
        }
    }

    private String formatBitrate(String bitrate) {
        log.debug("Formatting bitrate: {}", bitrate);
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
            log.debug("Formatted bitrate: {} -> {}", bitrate, formatted);
            return formatted;
        } catch (NumberFormatException e) {
            log.warn("Failed to parse bitrate: {}, returning original", bitrate, e);
            return bitrate;
        }
    }

    private String getLanguageName(String languageCode) {
        log.debug("Looking up language name for code: {}", languageCode);
        if (!StringUtils.hasText(languageCode)) {
            log.warn("Empty language code provided");
            return languageCode;
        }

        try {
            return spokenLanguageRepository.findById(languageCode)
                    .map(entity -> {
                        String name = StringUtils.hasText(entity.getName()) ?
                                entity.getName() : entity.getEnglish_name();
                        log.debug("Found language name: {} for code: {}", name, languageCode);
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

            log.debug("Title modifications to apply: {}", titleModifications);

            if (!Files.exists(inputPath)) {
                throw new DbWorldException("Input file does not exist: " + inputPath);
            }

            log.debug("Creating temporary output file");
            tempOutput = Files.createTempFile(inputPath.getParent(), "modified_", ".mkv");
            log.debug("Temporary file created: {}", tempOutput);

            log.debug("Building FFmpeg command");
            List<String> command = buildFfmpegCommand(inputPath, tempOutput, titleModifications, mediaFileInfo.getTrackInfos());
            log.debug("FFmpeg command built with {} arguments", command.size());

            log.debug("Executing FFmpeg command");
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
                log.debug("Attempting to clean up temporary file: {}", tempOutput);
                boolean deleted = Files.deleteIfExists(tempOutput);
                if (deleted) {
                    log.debug("Temporary file deleted successfully: {}", tempOutput);
                } else {
                    log.debug("Temporary file did not exist or could not be deleted: {}", tempOutput);
                }
            } catch (IOException e) {
                log.warn("Failed to delete temporary file: {}", tempOutput, e);
            }
        } else {
            log.debug("No temporary file to clean up");
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
        log.debug("Added input parameter: {}", inputPath);

        log.debug("Adding track filtering maps");
        addTrackFilteringMaps(command, trackInfoEntities);

        command.add("-c");
        command.add("copy");
        log.debug("Added copy codec parameter");

        log.debug("Adding metadata flags");
        addMetadataFlags(command, titleModifications);

        command.add("-y");
        command.add(outputPath.toString());
        log.debug("Added output parameter: {}", outputPath);

        log.info("FFmpeg command built with {} arguments", command.size());
        if (log.isDebugEnabled()) {
            log.debug("Full FFmpeg command: {}", String.join(" ", command));
        }

        return command;
    }

    private void addMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        log.debug("Adding metadata flags for {} modifications", titleModifications.size());

        addMetadataFlagIfPresent(command, "general", "title", titleModifications);
        addMetadataFlagIfPresent(command, "video", "s:v:0", "title", titleModifications);
        addAudioMetadataFlags(command, titleModifications);
        addSubtitleMetadataFlags(command, titleModifications);

        log.debug("Metadata flags added successfully");
    }

    private void addMetadataFlagIfPresent(List<String> command, String modificationKey,
                                          String ffmpegFlag, Map<String, String> titleModifications) {
        if (titleModifications.containsKey(modificationKey)) {
            String value = titleModifications.get(modificationKey);
            command.add("-metadata");
            command.add(ffmpegFlag + "=" + value);
            log.debug("Added metadata flag for {}: {}", modificationKey, value);
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
            log.debug("Added metadata flag for {}:{}: {}", streamType, modificationKey, value);
        } else {
            log.trace("Modification key not found: {}", modificationKey);
        }
    }

    private void addAudioMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        log.debug("Adding audio metadata flags");
        int audioFlagCount = 0;

        for (Map.Entry<String, String> entry : titleModifications.entrySet()) {
            if (entry.getKey().startsWith("audio_")) {
                String audioIndex = entry.getKey().replace("audio_", "");
                try {
                    int index = Integer.parseInt(audioIndex);
                    command.add("-metadata:s:a:" + index);
                    command.add("title=" + entry.getValue());
                    audioFlagCount++;
                    log.debug("Added audio metadata for track {}: {}", index, entry.getValue());
                } catch (NumberFormatException e) {
                    log.warn("Invalid audio index format: {}", audioIndex, e);
                }
            }
        }

        log.debug("Added {} audio metadata flags", audioFlagCount);
    }

    private void addSubtitleMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        log.debug("Adding subtitle metadata flags");
        int subtitleFlagCount = 0;

        for (Map.Entry<String, String> entry : titleModifications.entrySet()) {
            if (entry.getKey().startsWith("subtitle_id_")) {
                String subtitleIndex = entry.getKey().replace("subtitle_id_", "");
                try {
                    int index = Integer.parseInt(subtitleIndex);
                    command.add("-metadata:s:s:" + index);
                    command.add("title=" + entry.getValue());
                    subtitleFlagCount++;
                    log.debug("Added subtitle metadata for track {}: {}", index, entry.getValue());
                } catch (NumberFormatException e) {
                    log.warn("Invalid subtitle index format: {}", subtitleIndex, e);
                }
            }
        }

        log.debug("Added {} subtitle metadata flags", subtitleFlagCount);
    }

    private void executeFfmpegCommand(List<String> command, Path inputPath, Path tempOutput)
            throws IOException, InterruptedException {
        log.info("Executing FFmpeg command for input: {}", inputPath);
        long startTime = System.currentTimeMillis();

        log.debug("Full FFmpeg command: {}", String.join(" ", command));
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true);

        log.debug("Starting FFmpeg process");
        Process process = processBuilder.start();

        log.info("FFMPEG Command: [{}]", String.join(" ", processBuilder.command()));

        StringBuilder output = new StringBuilder();
        int lineCount = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            log.debug("Reading FFmpeg output...");
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                lineCount++;
                if (log.isTraceEnabled()) {
                    log.trace("FFmpeg output line {}: {}", lineCount, line);
                }
            }
            log.debug("Finished reading FFmpeg output. Total lines: {}", lineCount);
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

        log.debug("FFmpeg execution successful, moving temporary file to original location");
        dbWorldUtils.moveFileOrDir(tempOutput.toString(), inputPath.toString(), true);
        log.info("File modification completed successfully");
    }

    private void addTrackFilteringMaps(List<String> command, List<TrackInfoEntity> trackInfoEntities) {
        log.debug("Adding track filtering maps for {} tracks", trackInfoEntities.size());

        Set<Integer> audioTracksToKeep = getAudioTracksToKeep(trackInfoEntities);
        Set<Integer> subtitleTracksToKeep = getSubtitleTracksToKeep(trackInfoEntities);

        log.debug("Audio tracks to keep: {}", audioTracksToKeep);
        log.debug("Subtitle tracks to keep: {}", subtitleTracksToKeep);

        addAudioMapCommand(command, audioTracksToKeep);
        addSubtitleMapCommand(command, subtitleTracksToKeep);

        // Always add video track
        command.add("-map");
        command.add("0:v");
        log.debug("Added video track mapping");
    }

    private void addAudioMapCommand(List<String> command, Set<Integer> audioTracksToKeep) {
        log.debug("Adding audio map command for {} tracks", audioTracksToKeep.size());

        if (!audioTracksToKeep.isEmpty()) {
            for (int trackIndex : audioTracksToKeep) {
                command.add("-map");
                command.add("0:a:" + trackIndex);
                log.trace("Added audio map for track index: {}", trackIndex);
            }
            log.debug("Added {} specific audio track mappings", audioTracksToKeep.size());
        } else {
            command.add("-map");
            command.add("0:a");
            log.debug("Added all audio tracks mapping");
        }
    }

    private void addSubtitleMapCommand(List<String> command, Set<Integer> subtitleTracksToKeep) {
        log.debug("Adding subtitle map command for {} tracks", subtitleTracksToKeep.size());

        if (!subtitleTracksToKeep.isEmpty()) {
            for (int trackIndex : subtitleTracksToKeep) {
                command.add("-map");
                command.add("0:s:" + trackIndex);
                log.trace("Added subtitle map for track index: {}", trackIndex);
            }
            log.debug("Added {} specific subtitle track mappings", subtitleTracksToKeep.size());
        } else {
            command.add("-map");
            command.add("0:s");
            log.debug("Added all subtitle tracks mapping");
        }
    }

    private Set<Integer> getAudioTracksToKeep(List<TrackInfoEntity> trackInfoEntities) {
        log.debug("Determining audio tracks to keep from {} tracks", trackInfoEntities.size());
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

        log.debug("Found {} audio tracks with languages: {}", audioTrackCount, languageTracks.keySet());
        Set<Integer> result = filterAudioTracksByCustomRules(languageTracks);
        log.debug("Audio tracks to keep after filtering: {}", result);
        return result;
    }

    private Set<Integer> getSubtitleTracksToKeep(List<TrackInfoEntity> trackInfoEntities) {
        log.debug("Determining subtitle tracks to keep from {} tracks", trackInfoEntities.size());
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

        log.debug("Found {} subtitle tracks with languages: {}", subtitleTrackCount, languageTracks.keySet());
        Set<Integer> result = filterAudioTracksByCustomRules(languageTracks);
        log.debug("Subtitle tracks to keep after filtering: {}", result);
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
        log.debug("Filtering tracks by custom rules. Language tracks: {}", languageTracks);
        long startTime = System.currentTimeMillis();
        Set<Integer> tracksToKeep = new LinkedHashSet<>();

        // --- Guard clause: null or empty map ---
        if (languageTracks == null || languageTracks.isEmpty()) {
            log.debug("Language tracks is null or empty, returning empty set");
            return tracksToKeep; // nothing to keep
        }

        int total = languageTracks.values().stream().mapToInt(list -> list != null ? list.size() : 0).sum();
        log.debug("Total tracks found: {}", total);

        if (total == 0) {
            log.debug("No tracks present, returning empty set");
            return tracksToKeep; // no tracks present
        }

        // Filter out null or empty keys
        Set<String> langs = languageTracks.keySet().stream()
                .filter(Objects::nonNull)
                .filter(k -> !k.isBlank())
                .collect(Collectors.toSet());
        log.debug("Languages after filtering: {}", langs);

        // --- If langs is empty after cleaning ---
        if (langs.isEmpty()) {
            log.debug("No valid languages found, keeping all tracks");
            // We don't know the languages → safest option: keep all
            languageTracks.values().forEach(tracksToKeep::addAll);
            log.debug("Tracks to keep after keeping all: {}", tracksToKeep);
            return tracksToKeep;
        }

        // --- Single audio ---
        if (total == 1) {
            log.debug("Single track found, keeping it");
            languageTracks.values().forEach(tracksToKeep::addAll);
            return tracksToKeep;
        }

        // --- Dual audio ---
        if (total == 2) {
            log.debug("Dual tracks found, applying dual track rules");
            if (langs.contains(LANG_HINDI) && langs.contains(LANG_ENGLISH)) {
                log.debug("Hindi and English tracks found, keeping both");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
            } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI)) {
                log.debug("Hindi and Gujarati tracks found, keeping both");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            } else if (langs.contains(LANG_HINDI)) {
                log.debug("Only Hindi tracks found, keeping Hindi");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            } else if (langs.contains(LANG_GUJRATI) && langs.contains(LANG_UND)) {
                log.debug("Gujarati and undefined tracks found, keeping Gujarati");
                tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            } else {
                log.debug("No preferred language combination found, keeping all tracks");
                languageTracks.values().forEach(tracksToKeep::addAll);
            }
            log.debug("Dual track filtering result: {}", tracksToKeep);
            return tracksToKeep;
        }

        // --- Multi audio (> 2) ---
        log.debug("Multi-track scenario ({} tracks), applying multi-track rules", total);
        if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI) && langs.contains(LANG_ENGLISH)) {
            log.debug("Hindi, Gujarati and English tracks found, keeping all three");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
        } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_ENGLISH)) {
            log.debug("Hindi and English tracks found, keeping both");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_ENGLISH, List.of()));
        } else if (langs.contains(LANG_HINDI) && langs.contains(LANG_GUJRATI)) {
            log.debug("Hindi and Gujarati tracks found, keeping both");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
        } else if (langs.contains(LANG_HINDI)) {
            log.debug("Only Hindi tracks found, keeping Hindi");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_HINDI, List.of()));
        } else if (langs.contains(LANG_GUJRATI) && langs.contains(LANG_UND)) {
            log.debug("Gujarati and undefined tracks found, keeping Gujarati");
            tracksToKeep.addAll(languageTracks.getOrDefault(LANG_GUJRATI, List.of()));
        } else {
            log.debug("No preferred language combination found, keeping all tracks");
            languageTracks.values().forEach(tracksToKeep::addAll);
        }

        log.debug("Multi-track filtering completed in {} ms. Tracks to keep: {}",
                System.currentTimeMillis() - startTime, tracksToKeep);
        return tracksToKeep;
    }
}