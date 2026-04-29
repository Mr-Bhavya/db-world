package com.db.dbworld.utils;

import com.db.dbworld.config.AppConstants;
import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;
import org.springframework.util.StringUtils;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

@Service
@Log4j2
public class DbWorldUtils {

    private final AppProperties runtimeProperties;

    public DbWorldUtils (AppProperties runtimeProperties) {
        this.runtimeProperties = runtimeProperties;
    }

    public byte[] serialize(Object obj) throws IOException {
        try (
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ObjectOutputStream os = new ObjectOutputStream(out)
        ) {
            os.writeObject(obj);
            return out.toByteArray();
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }

    }

    public Object deserialize(byte[] data) {
        try (
                ByteArrayInputStream in = new ByteArrayInputStream(data);
                ObjectInputStream is = new ObjectInputStream(in);
        ) {
            return is.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public void checkRecordType(String type) {
        if (!type.equalsIgnoreCase(AppConstants.RECORD_TYE.MOVIE.name()) && !type.equalsIgnoreCase((AppConstants.RECORD_TYE.SERIES.name()))) {
            throw new DbWorldException(HttpStatus.BAD_REQUEST, "Record Type is not correct. Please Try again with valid record type.");
        }
    }

    public List<String> readFileInList(String filePath) {
        try {
            return Files.readAllLines(Paths.get(filePath), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    /**
     * Decodes a URL-encoded file name string while handling special character cases.
     *
     * @param encodedString The URL-encoded string to decode (cannot be null)
     * @return The decoded file name string
     * @throws DbWorldException if the input string is null or if decoding fails
     * @throws IllegalArgumentException if the input string is null
     */
    public String decodeFileName(String encodedString) {
        // Validate input parameter
        if (encodedString == null) {
            throw new IllegalArgumentException("Encoded string cannot be null");
        }

        try {
            // First decode the string (temporarily converting + to %2B to preserve literal +)
            String decodedString = URLDecoder.decode(
                    encodedString.replace("+", "%2B"),
                    StandardCharsets.UTF_8
            );

            // Restore actual + characters and remove problematic characters
            return cleanFileName(
                    decodedString.replace("%2B", "+")
            );
        } catch (Exception e) {
            throw new DbWorldException("Failed to decode file name: " + encodedString, e);
        }
    }

    /**
     * Cleans a file name by removing invalid characters.
     *
     * @param fileName The file name to clean
     * @return The cleaned file name with invalid characters removed
     */
    private String cleanFileName(String fileName) {
        return fileName.replace("/", "").replace("|", "");
    }

    public DbWorldRecords.FileSizeInfo getFileSizeInfo(Path path) {
        try {
            long size = Files.size(path);
            if (size <= 0) {
                throw new DbWorldException("Invalid file size: " + size);
            }
            return new DbWorldRecords.FileSizeInfo(size);
        } catch (IOException e) {
            throw new DbWorldException("Failed to determine file size for " + path, e);
        }
    }

    /**
     * Moves a file or directory from source to destination path, with options to handle existing files and error behavior.
     *
     * @param src The source path of the file/directory to move (cannot be null or empty)
     * @param des The destination path where to move the file/directory (cannot be null or empty)
     * @param throwOnError If true, throws exceptions on errors; if false, logs errors and continues
     * @throws DbWorldException if throwOnError is true and an error occurs during the operation
     * @throws IllegalArgumentException if src or des parameters are null or empty
     */
    public void moveFileOrDir(String src, String des, boolean throwOnError) {
        // Validate input parameters
        if (src == null || src.trim().isEmpty()) {
            throw new IllegalArgumentException("Source path cannot be null or empty");
        }
        if (des == null || des.trim().isEmpty()) {
            throw new IllegalArgumentException("Destination path cannot be null or empty");
        }

        Path sourcePath = Paths.get(src);
        Path destPath = Paths.get(des);

        try {
            // Check if source exists
            if (!Files.exists(sourcePath)) {
                String msg = "Source path does not exist: " + sourcePath;
                if (throwOnError) {
                    throw new IOException(msg);
                }
                log.warn(msg);
                return;
            }

            // Ensure destination parent directory exists
            if (destPath.getParent() != null) {
                Files.createDirectories(destPath.getParent());
            }

            // Handle existing destination
            if (Files.exists(destPath)) {
                // Delete destination recursively if it exists
                Files.walkFileTree(destPath, new SimpleFileVisitor<>() {
                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                        Files.delete(file);
                        return FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                        Files.delete(dir);
                        return FileVisitResult.CONTINUE;
                    }
                });
            }

            // Perform the move operation with overwrite
            Files.move(sourcePath, destPath, StandardCopyOption.REPLACE_EXISTING);

            log.info("Moved successfully from {} to {}", sourcePath, destPath);

        } catch (IOException e) {
            if (throwOnError) {
                throw new DbWorldException("Failed to move file or directory from " + src + " to " + des, e);
            } else {
                log.error("Failed to move file or directory from {} to {}", src, des, e);
            }
        }
    }

    public MediaType determineContentType(Path path) {
        try {
            String mimeType = Files.probeContentType(path);
            return MediaType.parseMediaType(mimeType != null ? mimeType : "application/octet-stream");
        } catch (IOException e) {
            log.warn("Could not determine content type for {}, defaulting to octet-stream", path);
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    public ContentDisposition createContentDisposition(Path path, boolean inline) {
        String filename = path.getFileName().toString();
        return inline ?
                ContentDisposition.inline().filename(filename).build() :
                ContentDisposition.attachment().filename(filename).build();
    }

    /**
     * Deletes a file or directory at the specified path with configurable error handling
     *
     * @param path The path of the file/directory to delete (cannot be null or empty)
     * @param throwOnError If true, throws exceptions on failures; if false, logs errors
     * @throws DbWorldException if throwOnError is true and deletion fails
     * @throws IllegalArgumentException if path is null or empty
     */
    public void deleteFileOrDirectory(String path, boolean throwOnError) throws DbWorldException {
        // Validate input
        if (path == null || path.trim().isEmpty()) {
            String errorMessage = "Path cannot be null or empty";
            if (throwOnError) {
                throw new IllegalArgumentException(errorMessage);
            }
            log.error(errorMessage);
            return;
        }

        try {
            Path filePath = Path.of(path);

            // Check if path exists
            if (!Files.exists(filePath)) {
                String warningMessage = "Path does not exist: " + path;
                if (throwOnError) {
                    throw new IOException(warningMessage);
                }
                log.warn(warningMessage);
                return;
            }

            // Delete the file/directory
            if (Files.isDirectory(filePath)) {
                FileSystemUtils.deleteRecursively(filePath);
                log.info("Successfully deleted directory: {}", path);
            } else {
                Files.delete(filePath);
                log.info("Successfully deleted file: {}", path);
            }

        } catch (IOException e) {
            String errorMessage = String.format("Failed to delete %s: %s",
                    Files.isDirectory(Path.of(path)) ? "directory" : "file",
                    e.getMessage());

            if (throwOnError) {
                throw new DbWorldException(errorMessage, e);
            }
            log.error(errorMessage);
        }
    }
//
//    private Map<String, String> generateTitleModifications(String mediaInfoJson, MediaFileDetails fileDetails) {
//        Map<String, String> modifications = new HashMap<>();
//
//        try {
//            JsonObject mediaInfo = JsonParser.parseString(mediaInfoJson).getAsJsonObject();
//            JsonArray tracks = mediaInfo.getAsJsonObject("media").getAsJsonArray("track");
//
//            // Generate general title based on record type
//            String generalTitle = generateGeneralTitle(fileDetails);
//            modifications.put("general", generalTitle);
//
//            // Process video track
//            processVideoTrack(tracks, modifications);
//
//            // Process audio tracks
//            processAudioTracks(tracks, modifications);
//
//            // Process subtitle tracks
//            processSubtitleTracks(tracks, modifications);
//
//        } catch (Exception e) {
//            log.warn("Failed to generate title modifications automatically: {}", e.getMessage());
//        }
//
//        return modifications;
//    }
//
//    private String generateGeneralTitle(MediaFileDetails fileDetails) {
//        if ("series".equalsIgnoreCase(fileDetails.getRecordType().name())) {
//            // Series format: "Show Name S01E03 - Episode Title"
//            String season = fileDetails.getSeason() != null ? fileDetails.getSeason() : "S01";
//            String episode = fileDetails.getEpisode() != null ? fileDetails.getSeason() : "E01";
//            return String.format("%s %s%s", fileDetails.getName(), season, episode);
//        } else {
//            // Movie format: "Movie Name (Year)"
//            return String.format("%s (%s)", fileDetails.getName(), fileDetails.getYear());
//        }
//    }
//
//    private void processVideoTrack(JsonArray tracks, Map<String, String> modifications) {
//        for (JsonElement trackElement : tracks) {
//            JsonObject track = trackElement.getAsJsonObject();
//            if ("Video".equals(track.get("@type").getAsString())) {
//                String format = track.get("Format").getAsString();
//                String profile = track.has("Format_Profile") ? track.get("Format_Profile").getAsString() : "";
//                String bitDepth = track.has("BitDepth") ? track.get("BitDepth").getAsString() + "bit" : "";
//                String resolution = track.has("Height") ? track.get("Height").getAsString() + "p" : "";
//
//                String videoTitle = String.format("%s %s %s %s", format, profile, bitDepth, resolution)
//                        .replaceAll("\\s+", " ")
//                        .trim();
//                modifications.put("video", videoTitle.isEmpty() ? "Main Video" : videoTitle);
//                break;
//            }
//        }
//    }

//    private void processAudioTracks(JsonArray tracks, Map<String, String> modifications) {
//        int audioIndex = 0;
//        for (JsonElement trackElement : tracks) {
//            JsonObject track = trackElement.getAsJsonObject();
//            if ("Audio".equals(track.get("@type").getAsString())) {
//                String format = track.get("Format").getAsString();
//                String language = track.has("Language") ? track.get("Language").getAsString() : "";
//                String channels = track.has("Channels") ? track.get("Channels").getAsString() + "ch" : "";
//                String bitrate = track.has("BitRate") ? formatBitrate(track.get("BitRate").getAsString()) : "";
//
//                String languageName = getLanguageName(language);
//                String audioTitle = String.format("%s %s %s %s", languageName, format, channels, bitrate)
//                        .replaceAll("\\s+", " ")
//                        .trim();
//
//                modifications.put("audio_" + audioIndex, audioTitle);
//                audioIndex++;
//            }
//        }
//    }
//
//    private void processSubtitleTracks(JsonArray tracks, Map<String, String> modifications) {
//        int subtitleIndex = 0;
//        for (JsonElement trackElement : tracks) {
//            JsonObject track = trackElement.getAsJsonObject();
//            if ("Text".equals(track.get("@type").getAsString())) {
//                String language = track.has("Language") ? track.get("Language").getAsString() : "";
//                String format = track.get("Format").getAsString();
//                String title = track.has("Title") ? track.get("Title").getAsString() : "";
//                boolean forced = track.has("Forced") && "Yes".equals(track.get("Forced").getAsString());
//
//                String languageName = getLanguageName(language);
//                String subtitleTitle;
//
//                if (!title.isEmpty() && !title.equals("SDH")) {
//                    subtitleTitle = String.format("%s %s", languageName, title);
//                } else if (forced) {
//                    subtitleTitle = String.format("%s %s [Forced]", languageName, format);
//                } else if ("SDH".equals(title)) {
//                    subtitleTitle = String.format("%s SDH", languageName);
//                } else {
//                    subtitleTitle = String.format("%s %s", languageName, format);
//                }
//
//                modifications.put("subtitle_id_" + subtitleIndex, subtitleTitle);
//                subtitleIndex++;
//            }
//        }
//    }
//
//    private String formatBitrate(String bitrate) {
//        try {
//            int bitrateValue = Integer.parseInt(bitrate);
//            if (bitrateValue >= 1000000) {
//                return String.format("%.1f Mbps", bitrateValue / 1000000.0);
//            } else if (bitrateValue >= 1000) {
//                return String.format("%d kbps", bitrateValue / 1000);
//            } else {
//                return bitrate + " bps";
//            }
//        } catch (NumberFormatException e) {
//            return bitrate;
//        }
//    }
//
//    // Overload for backward compatibility
//    public String runMediaInfoCommand(Path path, boolean modifyTitles, Map<String, String> titleModifications) {
//        try {
//            if (modifyTitles && titleModifications != null && !titleModifications.isEmpty()) {
//                modifyMediaTitles(path, titleModifications);
//            }
//
//            List<String> command = Arrays.asList(
//                    runtimeProperties.getMediaInfo(),
//                    "--output=JSON",
//                    path.toString()
//            );
//
//            ProcessBuilder processBuilder = new ProcessBuilder(command);
//            Process process = processBuilder.start();
//            log.info("MediaInfo command : {}", process.info().command());
//
//            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
//                StringBuilder output = new StringBuilder();
//                String line;
//                while ((line = reader.readLine()) != null) {
//                    output.append(line);
//                }
//                process.waitFor();
//                return output.toString();
//            }
//        } catch (Exception e) {
//            throw new DbWorldException("Error While running mediainfo command: " + e.getMessage());
//        }
//    }
//
//    private void modifyMediaTitles(Path inputPath, Map<String, String> titleModifications) {
//        try {
//            // Create temporary output file
//            Path tempOutput = Files.createTempFile("modified_", ".mkv");
//
//            List<String> command = new ArrayList<>();
//            command.add("ffmpeg");
//            command.add("-i");
//            command.add(inputPath.toString());
//            command.add("-c");
//            command.add("copy");
//
//            // Add metadata modifications based on the titleModifications map
//            if (titleModifications.containsKey("general")) {
//                command.add("-metadata");
//                command.add("title=" + titleModifications.get("general"));
//            }
//
//            if (titleModifications.containsKey("video")) {
//                command.add("-metadata:s:v:0");
//                command.add("title=" + titleModifications.get("video"));
//            }
//
//            // Audio tracks
//            for (int i = 0; i < 3; i++) { // Support up to 3 audio tracks
//                String audioKey = "audio_" + i;
//                if (titleModifications.containsKey(audioKey)) {
//                    command.add("-metadata:s:a:" + i);
//                    command.add("title=" + titleModifications.get(audioKey));
//                }
//            }
//
//            // Subtitle tracks (by ID)
//            for (String key : titleModifications.keySet()) {
//                if (key.startsWith("subtitle_id_")) {
//                    String subtitleId = key.replace("subtitle_id_", "");
//                    command.add("-metadata:s:s:" + subtitleId);
//                    command.add("title=" + titleModifications.get(key));
//                }
//            }
//
//            command.add("-y"); // Overwrite output file without asking
//            command.add(tempOutput.toString());
//
//            ProcessBuilder processBuilder = new ProcessBuilder(command);
//            Process process = processBuilder.start();
//
//            // Read error stream for debugging
//            try (BufferedReader errorReader = new BufferedReader(new InputStreamReader(process.getErrorStream()))) {
//                String errorLine;
//                while ((errorLine = errorReader.readLine()) != null) {
//                    log.debug("FFmpeg error output: {}", errorLine);
//                }
//            }
//
//            int exitCode = process.waitFor();
//
//            if (exitCode == 0) {
//                // Replace original file with modified file
//                Files.move(tempOutput, inputPath, StandardCopyOption.REPLACE_EXISTING);
//                log.info("Successfully modified media titles for: {}", inputPath);
//            } else {
//                Files.deleteIfExists(tempOutput);
//                throw new DbWorldException("FFmpeg failed with exit code: " + exitCode);
//            }
//
//        } catch (Exception e) {
//            throw new DbWorldException("Error modifying media titles: " + e.getMessage());
//        }
//    }

    public String getClientIpAddress(HttpServletRequest request) {
        try {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
                String[] ips = xForwardedFor.split(",");
                for (String ip : ips) {
                    String cleanedIp = ip.trim();
                    if (!cleanedIp.isEmpty() && !"unknown".equalsIgnoreCase(cleanedIp)) {
                        return cleanedIp;
                    }
                }
            }

            String[] headers = {
                    "X-Real-IP", "Proxy-Client-IP", "WL-Proxy-Client-IP",
                    "HTTP_CLIENT_IP", "HTTP_X_FORWARDED_FOR"
            };

            for (String header : headers) {
                String ip = request.getHeader(header);
                if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                    return ip;
                }
            }

            return request.getRemoteAddr();
        } catch (Exception e) {
            log.warn("Error extracting client IP address", e);
            return request.getRemoteAddr();
        }
    }

    public ZonedDateTime getISTDateTime(){
        return ZonedDateTime.ofInstant(Instant.now(), ZoneId.of("Asia/Kolkata"));
    }

}
