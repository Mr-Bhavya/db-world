package com.db.dbworld.services.media;

import com.db.dbworld.entities.dbcinema.stream.*;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.exception.ProcessExecutionException;
import com.db.dbworld.helpers.ProcessExecutor;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.services.media.resolver.MediaTagResolver;
import com.db.dbworld.core.processor.StreamProcessorFactory;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.persistence.EntityManager;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.function.Consumer;
import java.util.stream.Collectors;

import static com.db.dbworld.services.media.resolver.MediaTagResolver.*;

/**
 * @deprecated Multi-step FFmpeg/mediainfo command orchestration superseded by
 * {@link com.db.dbworld.app.media.info.service.MediaInfoService} (mediainfo) and
 * {@link com.db.dbworld.app.media.enrichment.TmdbMediaEnrichmentService} (FFmpeg one-pass).
 */
@Deprecated(forRemoval = true)
@Log4j2
@Service
public class MediaInfoCommandService {

    // Canonical preferred languages
    private static final String HINDI = "Hindi";
    private static final String ENGLISH = "English";
    private static final String GUJARATI = "Gujarati";
    private static final String UNKNOWN = "Unknown";

    private final DbWorldUtils dbWorldUtils;

    private final EntityManager entityManager;

    private final ProcessExecutor processExecutor;

    private final MediaFileNamingService mediaFileNamingService;

    public MediaInfoCommandService (DbWorldUtils dbWorldUtils,
                                    EntityManager entityManager, DbWorldRuntimeProperties runtimeProperties, ProcessExecutor processExecutor, MediaFileNamingService mediaFileNamingService) {
        this.dbWorldUtils = dbWorldUtils;
        this.entityManager = entityManager;
        this.processExecutor = processExecutor;
        this.mediaFileNamingService = mediaFileNamingService;
    }

    /**
     * Runs MediaInfo command with optional title modification and track filtering
     */
    public String modifyAndFilterTracksAndTitles(Path path, MediaFileDetails fileDetails) {
        log.info("Starting modifyAndFilterTracksAndTitles execution. fileDetails: {}",
                fileDetails != null ? fileDetails.getName() : "null");
        long startTime = System.currentTimeMillis();

        try {
            log.info("Step 1: Running initial MediaInfo command");
            String initialJson = processExecutor.runMediaInfoCommand(path);
            log.info("Initial MediaInfo JSON obtained, length: {}", initialJson.length());

            log.info("Step 2: Parsing MediaInfo JSON");
            List<MediaFileInfoEntity> mediaFileInfos = mediaFileNamingService.parseMediaInfoJson(fileDetails, initialJson);
            if (mediaFileInfos.isEmpty()) {
                log.warn("No MediaFileInfoEntity parsed from JSON");
                return initialJson;
            }

            MediaFileInfoEntity mediaFileInfo = mediaFileInfos.get(0);
            log.info("MediaFileInfoEntity parsed successfully with {} tracks",
                    mediaFileInfo.getTrackInfos().size());

            if (fileDetails != null) {
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

            log.info("Step 6: Running final MediaInfo command after modifications");
            String finalJson = processExecutor.runMediaInfoCommand(path);
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
            String newFilename = mediaFileNamingService.buildFileNameAndPath(fileDetails, mediaFileInfo);
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
        log.info("Generating general title for recordType: {}", fileDetails != null ? fileDetails.getRecordType() : "null");

        if (fileDetails == null) {
            log.warn("FileDetails is null, returning empty title");
            return "";
        }

        String name = StringUtils.trimToEmpty(fileDetails.getName());
        String year = StringUtils.trimToEmpty(fileDetails.getYear());

        if (DbWorldConstants.RECORD_TYE.SERIES == fileDetails.getRecordType()) {
            String season = StringUtils.defaultIfBlank(fileDetails.getSeason(), "S01");
            String episode = StringUtils.defaultIfBlank(fileDetails.getEpisode(), "E01");

            return year.isEmpty() ? String.format("%s %s%s", name, season, episode) : String.format("%s (%s) %s%s", name, year, season, episode);
        }

        // Movie
        return year.isEmpty() ? name : String.format("%s (%s)", name, year);
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

        if (!(track instanceof VideoInfoEntity video)) {
            log.warn("Track is not a VideoInfoEntity, type: {}", track.getType());
            return "Main Video";
        }

        // Codec (via resolver)
        String codec = MediaTagResolver.resolveVideoCodec(video.getFormat());
        if (StringUtils.isNotBlank(codec)) {
            titleParts.add(codec);
        }

        // Profile
        String profile = MediaTagResolver.VIDEO_PROFILE_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(video.getFormatProfile())), "");
        if (!profile.isEmpty()) {
            titleParts.add(profile);
        }

        // Bit depth
        if (video.getBitDepth() != null && video.getBitDepth() > 0) {
            titleParts.add(video.getBitDepth() + "bit");
        }

        // Resolution (bucketed)
        String resolution = MediaTagResolver.resolveResolution(video.getHeight());
        if (StringUtils.isNotBlank(resolution)) {
            titleParts.add(resolution);
        }

        // HDR (via resolver)
        String hdr = MediaTagResolver.resolveHdr(video.getHdrFormat());
        if (StringUtils.isNotBlank(hdr)) {
            titleParts.add(hdr);
        }

        String title = String.join(" ", titleParts).trim();
        log.info("Generated video title: {}", title);
        return title.isEmpty() ? "Main Video" : title;
    }


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

        // Language
        String rawLang = audioInfoTrack.getLanguage();
        String language = LANGUAGE_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(rawLang)), "");
        if (!language.isEmpty()) {
            titleParts.add(language);
            log.trace("Added language: {}", language);
        }

        // Codec / format
        if (StringUtils.isNotBlank(audioInfoTrack.getFormat())) {
            titleParts.add(audioInfoTrack.getFormat());
            log.trace("Added format: {}", audioInfoTrack.getFormat());
        }

        // Channels
        if (audioInfoTrack.getChannels() != null && audioInfoTrack.getChannels() > 0) {
            titleParts.add(audioInfoTrack.getChannels() + "CH");
            log.trace("Added channels: {}ch", audioInfoTrack.getChannels());
        }

        // Bitrate
        if (audioInfoTrack.getBitRate() != null && audioInfoTrack.getBitRate() > 0) {
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
        if (!(track instanceof TextInfoEntity text)) {
            return "";
        }

        // Language
        String language = LANGUAGE_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(text.getLanguage())), "");

        // Format
        String format = SUB_FORMAT_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(text.getFormat())), "");

        // Semantic title
        String semanticTitle = SUB_TITLE_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(text.getTitle())), "");

        boolean forced = "Yes".equalsIgnoreCase(text.getForced());

        List<String> parts = new ArrayList<>();

        if (!language.isEmpty()) parts.add(language);

        if (!semanticTitle.isEmpty()) {
            parts.add(semanticTitle);
        } else if (!format.isEmpty()) {
            parts.add(format);
        }

        if (forced) {
            parts.add("[Forced]");
        }

        return String.join(" ", parts).trim();
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

        // Debug logging
        debugTrackInfo(trackInfoEntities);

        List<String> command = new ArrayList<>();
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
                .sorted().toList();

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

    private void executeFfmpegCommand(List<String> command, Path inputPath, Path tempOutput) throws ProcessExecutionException {

        processExecutor.executeFfmpegCommand(
                command, StreamProcessorFactory.createFfmpegProcessor(), null
        );

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

        // Preferred languages (canonical names)
        final Set<String> PREFERRED_LANGUAGES = Set.of(ENGLISH, HINDI, GUJARATI);

        Map<String, List<Integer>> languageTracks = new HashMap<>();
        int subtitleStreamIndex = 0;

        // Collect subtitle stream indices grouped by canonical language
        for (TrackInfoEntity track : trackInfoEntities) {
            if (!"Text".equalsIgnoreCase(track.getType())) {
                continue;
            }

            String rawLang = extractLanguage(track); // may be hi/eng/Hindi/etc
            String canonicalLang = MediaTagResolver.resolveLanguage(rawLang);

            languageTracks
                    .computeIfAbsent(canonicalLang, k -> new ArrayList<>())
                    .add(subtitleStreamIndex);

            log.trace("Subtitle stream index {} resolved to language: {} (raw: {})",
                    subtitleStreamIndex, canonicalLang, rawLang);

            subtitleStreamIndex++;
        }

        log.info("Found subtitle languages: {}", languageTracks.keySet());

        // Check if any preferred language exists
        boolean hasPreferred = languageTracks.keySet()
                .stream()
                .anyMatch(PREFERRED_LANGUAGES::contains);

        Set<Integer> result = new HashSet<>();

        if (hasPreferred) {
            for (var entry : languageTracks.entrySet()) {
                if (PREFERRED_LANGUAGES.contains(entry.getKey())) {
                    result.addAll(entry.getValue());
                    log.debug("Keeping {} subtitle tracks for language {} at indices {}",
                            entry.getValue().size(), entry.getKey(), entry.getValue());
                } else {
                    log.debug("Discarding subtitle tracks for language {} at indices {}",
                            entry.getKey(), entry.getValue());
                }
            }
        } else {
            // No preferred languages → keep all
            languageTracks.values().forEach(result::addAll);
            log.info("No preferred languages found. Keeping all subtitle tracks: {}", result);
        }

        log.info("Final subtitle stream indices to keep: {}", result);
        return result;
    }


    private String extractLanguage(TrackInfoEntity track) {
        String rawLang = "und";
        if (track instanceof AudioInfoEntity audio) {
            rawLang = audio.getLanguage();
            log.trace("Raw audio language: {}", rawLang);
        } else if (track instanceof TextInfoEntity text) {
            rawLang = text.getLanguage();
            log.trace("Raw subtitle language: {}", rawLang);
        } else {
            log.trace("Track type {} not handled for language extraction", track.getType());
        }

        String normalized = LANGUAGE_MAP.getOrDefault(StringUtils.lowerCase(StringUtils.trimToEmpty(rawLang)), "und");

        log.trace("Normalized language: {}", normalized);
        return normalized;
    }

    /**
     * Filters audio tracks based on custom business rules.
     * <p>
     * IMPORTANT INVARIANT:
     * --------------------
     * The input map MUST already contain canonical language names as keys.
     * Example keys:
     *   "Hindi", "English", "Gujarati", "Spanish", "Unknown", ...
     * <p>
     * This means raw values like:
     *   hi, hin, HINDI, eng, en, guj, etc.
     * MUST already be normalized via:
     *   MediaTagResolver.resolveLanguage(...)
     * <p>
     * ----------------------------------------
     * BUSINESS RULES (Decision Matrix)
     * ----------------------------------------
     * <p>
     * Preferred language priority:
     *   1. Hindi     (primary)
     *   2. English   (secondary)
     *   3. Gujarati  (regional)
     *   4. Unknown   (fallback)
     *   5. Others    (Spanish, French, etc.)
     * <p>
     * SINGLE AUDIO (total = 1)
     * ------------------------
     * Always keep the only track.
     * <p>
     * Examples:
     *   {Hindi}       -> keep Hindi
     *   {Spanish}    -> keep Spanish
     *   {Unknown}    -> keep Unknown
     * <p>
     * DUAL AUDIO (total = 2)
     * ---------------------
     * Preferred combinations:
     *   {Hindi, English}   -> keep both
     *   {Hindi, Gujarati}  -> keep both
     *   {Hindi, Unknown}   -> keep Hindi
     *   {Gujarati, Unknown}-> keep Gujarati
     * <p>
     * Fallback cases:
     *   {English, Gujarati} -> keep both (no Hindi rule)
     *   {English, Unknown}  -> keep both
     *   {Spanish, French}   -> keep both
     *   {Spanish, Hindi}    -> keep Hindi
     * <p>
     * MULTI AUDIO (total >= 3)
     * -----------------------
     * Priority ladder:
     * <p>
     *   1. If (Hindi + English + Gujarati) -> keep all three
     *   2. Else if (Hindi + English)       -> keep both
     *   3. Else if (Hindi + Gujarati)      -> keep both
     *   4. Else if (Hindi)                 -> keep Hindi
     *   5. Else if (Gujarati + Unknown)    -> keep Gujarati
     *   6. Else                            -> keep ALL tracks
     * <p>
     * Examples:
     *   {Hindi, English, Gujarati, Spanish}
     *       -> keep Hindi + English + Gujarati
     * <p>
     *   {Hindi, English, Spanish}
     *       -> keep Hindi + English
     * <p>
     *   {Hindi, Spanish, French}
     *       -> keep Hindi
     * <p>
     *   {Gujarati, Unknown, Spanish}
     *       -> keep Gujarati
     * <p>
     *   {English, Spanish, French}
     *       -> keep ALL (no Hindi / Gujarati rule)
     * <p>
     * DESIGN PRINCIPLE:
     * -----------------
     * Hindi is king.
     * English is queen.
     * Gujarati is regional.
     * Unknown is garbage.
     * Everything else is filler.
     * <p>
     * This method must NEVER deal with raw language codes.
     * All chaos is handled by MediaTagResolver.
     */
    private Set<Integer> filterAudioTracksByCustomRules(Map<String, List<Integer>> languageTracks) {

        log.info("Filtering audio tracks by custom rules. Languages: {}", languageTracks.keySet());
        long startTime = System.currentTimeMillis();
        Set<Integer> tracksToKeep = new LinkedHashSet<>();

        // Guard clause: no tracks
        if (languageTracks.isEmpty()) {
            log.info("No language tracks found, returning empty set");
            return tracksToKeep;
        }

        int total = languageTracks.values().stream().mapToInt(List::size).sum();
        log.info("Total audio tracks: {}", total);

        // Single or zero track -> keep all
        if (total <= 1) {
            languageTracks.values().forEach(tracksToKeep::addAll);
            log.info("Single or zero track, keeping all: {}", tracksToKeep);
            return tracksToKeep;
        }

        Set<String> langs = languageTracks.keySet();
        log.info("Resolved canonical languages: {}", langs);

        // Helper to add all tracks for a language
        Consumer<String> keep = lang -> tracksToKeep.addAll(languageTracks.getOrDefault(lang, List.of()));

        /*
         * DECISION MATRIX
         * (applies to both dual and multi-audio scenarios)
         */

        if (langs.containsAll(Set.of(HINDI, GUJARATI, ENGLISH))) {
            // Hindi + English + Gujarati -> keep all three
            keep.accept(HINDI);
            keep.accept(GUJARATI);
            keep.accept(ENGLISH);

        } else if (langs.containsAll(Set.of(HINDI, ENGLISH))) {
            // Hindi + English -> keep both
            keep.accept(HINDI);
            keep.accept(ENGLISH);

        } else if (langs.containsAll(Set.of(HINDI, GUJARATI))) {
            // Hindi + Gujarati -> keep both
            keep.accept(HINDI);
            keep.accept(GUJARATI);

        } else if (langs.contains(HINDI)) {
            // Only Hindi present -> keep Hindi
            keep.accept(HINDI);

        } else if (langs.contains(GUJARATI) && langs.contains(UNKNOWN)) {
            // Gujarati + Unknown -> drop garbage, keep Gujarati
            keep.accept(GUJARATI);

        } else {
            // No preferred combination -> safest fallback: keep everything
            languageTracks.values().forEach(tracksToKeep::addAll);
        }

        log.info("Audio track filtering completed in {} ms. Tracks to keep: {}",
                System.currentTimeMillis() - startTime, tracksToKeep);

        return tracksToKeep;
    }


    private void debugTrackInfo(List<TrackInfoEntity> trackInfoEntities) {
        log.info("=== DEBUG: Analyzing track info ===");
        int videoCount = 0;
        int audioCount = 0;
        int subtitleCount = 0;

        for (int i = 0; i < trackInfoEntities.size(); i++) {
            TrackInfoEntity track = trackInfoEntities.get(i);
            String type = track.getType();
            String language = extractLanguage(track);

            if ("Video".equalsIgnoreCase(type)) {
                log.info("Track {}: VIDEO - Language: {}", i, language);
                videoCount++;
            } else if ("Audio".equalsIgnoreCase(type)) {
                log.info("Track {}: AUDIO - Language: {}", i, language);
                audioCount++;
            } else if ("Text".equalsIgnoreCase(type)) {
                log.info("Track {}: SUBTITLE - Language: {} -> FFmpeg subtitle index: {}",
                        i, language, subtitleCount);
                subtitleCount++;
            }
        }

        log.info("=== Summary: {} total tracks ({} video, {} audio, {} subtitle) ===",
                trackInfoEntities.size(), videoCount, audioCount, subtitleCount);
    }

}