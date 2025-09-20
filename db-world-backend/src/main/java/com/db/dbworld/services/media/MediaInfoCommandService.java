package com.db.dbworld.services.media;

import com.db.dbworld.dao.dbcinema.tmdb.SpokenLanguageRepository;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.payloads.mediafile.MediaFileDetails;
import com.db.dbworld.utils.DbWorldConstants;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;

@Log4j2
@Service
public class MediaInfoCommandService {

    @Autowired
    SpokenLanguageRepository spokenLanguageRepository;

    /**
     * Runs MediaInfo command to get media file metadata in JSON format
     *
     * @param path Path to the media file
     * @return JSON string containing media information
     */
    public String runMediaInfoCommand(Path path) {
        try {
            List<String> command = Arrays.asList(
                    DbWorldConstants.MEDIAINFO,
                    "--output=JSON",
                    path.toString()
            );

            ProcessBuilder processBuilder = new ProcessBuilder(command);
            Process process = processBuilder.start();
            log.info("MediaInfo command: {}", String.join(" ", process.info().commandLine().orElse(command.toString())));

            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line);
                }
                process.waitFor();
                return output.toString();
            }
        } catch (Exception e) {
            throw new DbWorldException("Error while running mediainfo command: " + e.getMessage(), e);
        }
    }

    /**
     * Runs MediaInfo command with optional title modification
     *
     * @param path Path to the media file
     * @param modifyTitles Whether to modify track titles
     * @param fileDetails File details for title generation
     * @return JSON string containing updated media information
     */
    public String runMediaInfoCommand(Path path, boolean modifyTitles, MediaFileDetails fileDetails) {
        try {
            // First get current media info to analyze tracks
            String initialJson = runMediaInfoCommand(path);

            // If title modification is requested, analyze and modify the file
            if (modifyTitles && fileDetails != null) {
                Map<String, String> titleModifications = generateTitleModifications(initialJson, fileDetails);
                if (!titleModifications.isEmpty()) {
                    modifyMediaTitles(path, titleModifications);
                }
            }

            // Return updated media info
            return runMediaInfoCommand(path);

        } catch (Exception e) {
            throw new DbWorldException("Error while running mediainfo command: " + e.getMessage(), e);
        }
    }

    /**
     * Generates title modifications based on media info and file details
     *
     * @param mediaInfoJson MediaInfo JSON output
     * @param fileDetails File details containing metadata
     * @return Map of title modifications to apply
     */
    private Map<String, String> generateTitleModifications(String mediaInfoJson, MediaFileDetails fileDetails) {
        Map<String, String> modifications = new HashMap<>();

        try {
            JsonObject mediaInfo = JsonParser.parseString(mediaInfoJson).getAsJsonObject();
            JsonArray tracks = mediaInfo.getAsJsonObject("media").getAsJsonArray("track");

            // Generate titles for different track types
            modifications.put("general", generateGeneralTitle(fileDetails));
            findAndProcessVideoTrack(tracks, modifications);
            processAudioTracks(tracks, modifications);
            processSubtitleTracks(tracks, modifications);

        } catch (Exception e) {
            log.warn("Failed to generate title modifications automatically: {}", e.getMessage());
        }

        return modifications;
    }

    /**
     * Generates general title based on record type (movie/series)
     *
     * @param fileDetails File details containing type, name, season, episode, year
     * @return Formatted general title
     */
    private String generateGeneralTitle(MediaFileDetails fileDetails) {
        if ("series".equalsIgnoreCase(fileDetails.getRecordType())) {
            String season = StringUtils.hasText(fileDetails.getSeason()) ? fileDetails.getSeason() : "S01";
            String episode = StringUtils.hasText(fileDetails.getEpisode()) ? fileDetails.getEpisode() : "E01";
            return String.format("%s %s%s", fileDetails.getName(), season, episode);
        } else {
            String year = StringUtils.hasText(fileDetails.getYear()) ? fileDetails.getYear() : "";
            return year.isEmpty() ? fileDetails.getName() : String.format("%s (%s)", fileDetails.getName(), year);
        }
    }

    /**
     * Finds and processes the video track to generate appropriate title
     *
     * @param tracks Array of media tracks
     * @param modifications Map to store title modifications
     */
    private void findAndProcessVideoTrack(JsonArray tracks, Map<String, String> modifications) {
        for (JsonElement trackElement : tracks) {
            JsonObject track = trackElement.getAsJsonObject();
            if ("Video".equals(track.get("@type").getAsString())) {
                modifications.put("video", generateVideoTitle(track));
                break;
            }
        }
    }

    /**
     * Generates video track title from track metadata
     *
     * @param track Video track JSON object
     * @return Formatted video title
     */
    private String generateVideoTitle(JsonObject track) {
        List<String> titleParts = new ArrayList<>();

        if (track.has("Format")) titleParts.add(track.get("Format").getAsString());
        if (track.has("Format_Profile")) titleParts.add(track.get("Format_Profile").getAsString());
        if (track.has("BitDepth")) titleParts.add(track.get("BitDepth").getAsString() + "bit");
        if (track.has("Height")) titleParts.add(track.get("Height").getAsString() + "p");

        String title = String.join(" ", titleParts).trim();
        return title.isEmpty() ? "Main Video" : title;
    }

    /**
     * Processes all audio tracks and generates appropriate titles
     *
     * @param tracks Array of media tracks
     * @param modifications Map to store title modifications
     */
    private void processAudioTracks(JsonArray tracks, Map<String, String> modifications) {
        int audioIndex = 0;
        for (JsonElement trackElement : tracks) {
            JsonObject track = trackElement.getAsJsonObject();
            if ("Audio".equals(track.get("@type").getAsString())) {
                modifications.put("audio_" + audioIndex, generateAudioTitle(track));
                audioIndex++;
            }
        }
    }

    /**
     * Generates audio track title from track metadata
     *
     * @param track Audio track JSON object
     * @return Formatted audio title
     */
    private String generateAudioTitle(JsonObject track) {
        List<String> titleParts = new ArrayList<>();

        String language = track.has("Language") ? getLanguageName(track.get("Language").getAsString()) : "";
        if (!language.isEmpty()) titleParts.add(language);
        if (track.has("Format")) titleParts.add(track.get("Format").getAsString());
        if (track.has("Channels")) titleParts.add(track.get("Channels").getAsString() + "ch");
        if (track.has("BitRate")) titleParts.add(formatBitrate(track.get("BitRate").getAsString()));

        return String.join(" ", titleParts).trim();
    }

    /**
     * Processes all subtitle tracks and generates appropriate titles
     *
     * @param tracks Array of media tracks
     * @param modifications Map to store title modifications
     */
    private void processSubtitleTracks(JsonArray tracks, Map<String, String> modifications) {
        int subtitleIndex = 0;
        for (JsonElement trackElement : tracks) {
            JsonObject track = trackElement.getAsJsonObject();
            if ("Text".equals(track.get("@type").getAsString())) {
                modifications.put("subtitle_id_" + subtitleIndex, generateSubtitleTitle(track));
                subtitleIndex++;
            }
        }
    }

    /**
     * Generates subtitle track title from track metadata
     *
     * @param track Subtitle track JSON object
     * @return Formatted subtitle title
     */
    private String generateSubtitleTitle(JsonObject track) {
        String language = track.has("Language") ? getLanguageName(track.get("Language").getAsString()) : "";
        String format = track.has("Format") ? track.get("Format").getAsString() : "";
        String existingTitle = track.has("Title") ? track.get("Title").getAsString() : "";
        boolean forced = track.has("Forced") && "Yes".equals(track.get("Forced").getAsString());

        if (StringUtils.hasText(existingTitle) && !"SDH".equals(existingTitle)) {
            return String.format("%s %s", language, existingTitle);
        } else if (forced) {
            return String.format("%s %s [Forced]", language, format);
        } else if ("SDH".equals(existingTitle)) {
            return String.format("%s SDH", language);
        } else {
            return String.format("%s %s", language, format);
        }
    }

    /**
     * Formats bitrate from bps to human-readable format
     *
     * @param bitrate Bitrate in bps
     * @return Formatted bitrate string
     */
    private String formatBitrate(String bitrate) {
        try {
            int bitrateValue = Integer.parseInt(bitrate);
            if (bitrateValue >= 1_000_000) {
                return String.format("%.1f Mbps", bitrateValue / 1_000_000.0);
            } else if (bitrateValue >= 1000) {
                return String.format("%d kbps", bitrateValue / 1000);
            }
            return bitrate + " bps";
        } catch (NumberFormatException e) {
            return bitrate;
        }
    }

    /**
     * Gets language name from language code using repository
     *
     * @param languageCode ISO language code
     * @return Language name or code if not found
     */
    private String getLanguageName(String languageCode) {
        return spokenLanguageRepository.findById(languageCode)
                .map(entity -> StringUtils.hasText(entity.getName()) ?
                        entity.getName() : entity.getEnglish_name())
                .orElse(languageCode);
    }

    /**
     * Modifies media file titles using FFmpeg without re-encoding
     *
     * @param inputPath Path to the input media file
     * @param titleModifications Map containing title modifications for different tracks
     * @throws DbWorldException if the operation fails
     */
    private void modifyMediaTitles(Path inputPath, Map<String, String> titleModifications) {
        Path tempOutput = null;

        try {
            // Validate input parameters
            if (titleModifications == null || titleModifications.isEmpty()) {
                log.info("No title modifications specified for file: {}", inputPath);
                return;
            }

            if (!Files.exists(inputPath)) {
                throw new DbWorldException("Input file does not exist: " + inputPath);
            }

            // Create temporary output file in the same directory as input
            tempOutput = Files.createTempFile(inputPath.getParent(), "modified_", ".mkv");

            // Build FFmpeg command
            List<String> command = buildFfmpegCommand(inputPath, tempOutput, titleModifications);

            // Execute FFmpeg command
            executeFfmpegCommand(command, inputPath, tempOutput);

            log.info("Successfully modified media titles for: {}", inputPath);

        } catch (Exception e) {
            // Clean up temporary file on error
            if (tempOutput != null) {
                try {
                    Files.deleteIfExists(tempOutput);
                } catch (IOException ioException) {
                    log.warn("Failed to delete temporary file: {}", tempOutput, ioException);
                }
            }
            throw new DbWorldException("Error modifying media titles for file: " + inputPath, e);
        }
    }

    /**
     * Builds FFmpeg command with metadata modifications
     *
     * @param inputPath Input file path
     * @param outputPath Output file path
     * @param titleModifications Title modifications map
     * @return List of command arguments
     */
    private List<String> buildFfmpegCommand(Path inputPath, Path outputPath,
                                            Map<String, String> titleModifications) {
        List<String> command = new ArrayList<>();
        command.add("ffmpeg");
        command.add("-i");
        command.add(inputPath.toString());
        command.add("-c");
        command.add("copy");

        // Add metadata flags based on modification map
        addMetadataFlags(command, titleModifications);

        command.add("-y"); // Overwrite output without prompt
        command.add(outputPath.toString());

        return command;
    }

    /**
     * Adds metadata flags to the FFmpeg command based on title modifications
     *
     * @param command FFmpeg command list
     * @param titleModifications Title modifications map
     */
    private void addMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        // General metadata (container level)
        addMetadataFlagIfPresent(command, "general", "title", titleModifications);

        // Video track metadata
        addMetadataFlagIfPresent(command, "video", "s:v:0", "title", titleModifications);

        // Audio tracks metadata (support unlimited tracks)
        addAudioMetadataFlags(command, titleModifications);

        // Subtitle tracks metadata
        addSubtitleMetadataFlags(command, titleModifications);
    }

    /**
     * Adds metadata flag for a specific key if present in modifications
     *
     * @param command FFmpeg command list
     * @param modificationKey Key in modifications map
     * @param ffmpegFlag FFmpeg metadata flag
     * @param titleModifications Title modifications map
     */
    private void addMetadataFlagIfPresent(List<String> command, String modificationKey,
                                          String ffmpegFlag, Map<String, String> titleModifications) {
        if (titleModifications.containsKey(modificationKey)) {
            command.add("-metadata");
            command.add(ffmpegFlag + "=" + titleModifications.get(modificationKey));
        }
    }

    /**
     * Adds metadata flag for specific stream type if present in modifications
     *
     * @param command FFmpeg command list
     * @param modificationKey Key in modifications map
     * @param streamType Stream type (v, a, s)
     * @param valueKey Value key (title, language, etc.)
     * @param titleModifications Title modifications map
     */
    private void addMetadataFlagIfPresent(List<String> command, String modificationKey,
                                          String streamType, String valueKey,
                                          Map<String, String> titleModifications) {
        if (titleModifications.containsKey(modificationKey)) {
            command.add("-metadata:" + streamType);
            command.add(valueKey + "=" + titleModifications.get(modificationKey));
        }
    }

    /**
     * Adds metadata flags for all audio tracks
     *
     * @param command FFmpeg command list
     * @param titleModifications Title modifications map
     */
    private void addAudioMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        titleModifications.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith("audio_"))
                .forEach(entry -> {
                    String audioIndex = entry.getKey().replace("audio_", "");
                    try {
                        int index = Integer.parseInt(audioIndex);
                        command.add("-metadata:s:a:" + index);
                        command.add("title=" + entry.getValue());
                    } catch (NumberFormatException e) {
                        log.warn("Invalid audio index format: {}", audioIndex);
                    }
                });
    }

    /**
     * Adds metadata flags for all subtitle tracks
     *
     * @param command FFmpeg command list
     * @param titleModifications Title modifications map
     */
    private void addSubtitleMetadataFlags(List<String> command, Map<String, String> titleModifications) {
        titleModifications.entrySet().stream()
                .filter(entry -> entry.getKey().startsWith("subtitle_id_"))
                .forEach(entry -> {
                    String subtitleIndex = entry.getKey().replace("subtitle_id_", "");
                    try {
                        int index = Integer.parseInt(subtitleIndex);
                        command.add("-metadata:s:s:" + index);
                        command.add("title=" + entry.getValue());
                    } catch (NumberFormatException e) {
                        log.warn("Invalid subtitle index format: {}", subtitleIndex);
                    }
                });
    }

    /**
     * Executes FFmpeg command and handles the result
     *
     * @param command FFmpeg command to execute
     * @param inputPath Original input file path
     * @param tempOutput Temporary output file path
     * @throws IOException if I/O operations fail
     * @throws InterruptedException if process is interrupted
     */
    private void executeFfmpegCommand(List<String> command, Path inputPath, Path tempOutput)
            throws IOException, InterruptedException {

        log.debug("Executing FFmpeg command: {}", String.join(" ", command));

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.redirectErrorStream(true); // Merge stdout and stderr

        Process process = processBuilder.start();

        // Read and log process output
        StringBuilder output = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                log.trace("FFmpeg output: {}", line);
            }
        }

        int exitCode = process.waitFor();

        if (exitCode != 0) {
            throw new DbWorldException(String.format(
                    "FFmpeg failed with exit code %d. Output: %s",
                    exitCode, output.toString().trim()
            ));
        }

        // Replace original file with modified file

        Files.move(tempOutput, inputPath, StandardCopyOption.REPLACE_EXISTING);
    }

    /**
     * Validates if FFmpeg is available on the system
     *
     * @return true if FFmpeg is available, false otherwise
     */
    private boolean isFfmpegAvailable() {
        try {
            Process process = new ProcessBuilder("ffmpeg", "-version").start();
            return process.waitFor() == 0;
        } catch (Exception e) {
            log.warn("FFmpeg is not available: {}", e.getMessage());
            return false;
        }
    }

}
