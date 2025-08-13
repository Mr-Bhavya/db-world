package com.db.dbworld.handler;

import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.cinema.DBCinemaRecordsService;
import com.db.dbworld.services.media.MediaFileInfoService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
@Service("mediaFileHandler")
public class MediaFileHandler {

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    private final static String MOVIES_FOLDER = "movies";
    private final static String SERIES_FOLDER = "series";
    private final static String UNASSIGNED_FOLDER = "unassigned";

    public void processFile(File file) {
        try {
            Path path = file.toPath();

            // Check each directory segment for UNASSIGNED_FOLDER
            boolean isUnassigned = false;
            for (Path segment : path) {
                if (segment.toString().equals(UNASSIGNED_FOLDER)) {
                    isUnassigned = true;
                    break;
                }
            }

            if (isUnassigned) {
                processUnassignedFile(file);
            } else {
                processAssignedFile(file);
            }
        } catch (Exception e) {
            log.error("Error processing file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private void processUnassignedFile(File file) {
        try {
            String sourceFile = file.getPath();
            Path sourceFilePath = file.toPath();
            if (file.exists()) {
                // Extract the relative path after "unassigned"
                String relativePath = sourceFile.substring(sourceFile.indexOf(UNASSIGNED_FOLDER) + UNASSIGNED_FOLDER.length() + 1);
                relativePath = normalizePath(relativePath);

                // Determine if it's a series or movie based on path pattern
                String targetPath;
                String seasonEpisode = extractSeasonEpisode(relativePath);

                if (seasonEpisode != null) {
                    // It's a series
                    String seriesName = extractSeriesName(relativePath);
                    String season = seasonEpisode.substring(0, 3); // S01
                    targetPath = String.format("%s/%s/%s/%s/%s",
                            normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                            UNASSIGNED_FOLDER,
                            seriesName,
                            season,
                            sourceFilePath.getFileName().toString());
                } else {
                    // It's a movie
                    targetPath = String.format("%s/%s/%s",
                            normalizePath(DbWorldConstants.STREAM_HOME_PATH),
                            UNASSIGNED_FOLDER,
                            sourceFilePath.getFileName().toString());
                }

                // Just move the file without creating media info
                dbWorldUtils.moveFileOrDir(sourceFile, targetPath, true);
                log.info("Moved unassigned file from {} to {}", sourceFile, targetPath);
            } else {
                log.info("File not found, skipping: {}", file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error("Error processing unassigned file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private String extractSeasonEpisode(String path) {
        // Match patterns like S01E01, S02E03, s01e02 (case-insensitive)
        Pattern pattern = Pattern.compile("([sS]\\d{2}[eE]\\d{2})");
        Matcher matcher = pattern.matcher(path);
        return matcher.find() ? matcher.group().toUpperCase() : null;
    }

    private String extractSeriesName(String path) {
        // Remove any file system specific characters
        path = path.replace("\\", "/");

        // Extract series name from path (everything before season folder)
        int seasonIndex = path.indexOf("S0");
        if (seasonIndex == -1) seasonIndex = path.indexOf("s0");
        if (seasonIndex == -1) return "Unknown";

        // Get the last path component before season
        String[] parts = path.substring(0, seasonIndex).split("/");
        String seriesName = parts[parts.length - 1];

        // Clean up any special characters
        return seriesName.replaceAll("[^a-zA-Z0-9 .'-]", "");
    }

    private void processAssignedFile(File file) {
        try {
            Map<String, String> map = extractBaseFolder(file.getPath())
                    .orElseThrow(() -> new DbWorldException("Unable to retrieve recordId from folder path: " + file.getPath()));
            Long recordId = parseRecordId(map.get("recordIdFolder"));
            String sourcePath = file.getPath();
            if (file.exists()) {
                List<MediaFileInfoEntity> mediaFileInfoEntities = storeMediaInfo(recordId, file.toPath(), map.get("streamFolderFilePath"));
                dbWorldUtils.moveFileOrDir(sourcePath, map.get("streamFolderFilePath"), true);
                log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), recordId);
            } else {
                handleFileDeletion(file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error("Error processing assigned file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private Optional<Map<String, String>> extractBaseFolder(String file) {
        file = normalizePath(file);
        Path filePath = Paths.get(file);
        String baseDirectory = normalizePath(DbWorldConstants.INTEGRATION_FOLDER_PATH);
        if (!file.startsWith(baseDirectory)) {
            return Optional.empty();
        }
        String relativePath = file.substring(baseDirectory.length());
        String baseFolderPattern = "\\d+-[a-zA-Z0-9 .:'\\-]+";
        String seasonEpisodePattern = "S\\d{2}E\\d{2}";
        Pattern baseFolderRegex = Pattern.compile(baseFolderPattern);
        Matcher baseFolderMatcher = baseFolderRegex.matcher(relativePath);
        String baseFolder = baseFolderMatcher.find() ? createFolderName(baseFolderMatcher.group()) : null;
        Pattern seasonEpisodeRegex = Pattern.compile(seasonEpisodePattern);
        Matcher seasonEpisodeMatcher = seasonEpisodeRegex.matcher(relativePath);
        String matcherString = seasonEpisodeMatcher.find() ? seasonEpisodeMatcher.group() : null;
        String season = matcherString != null ? matcherString.substring(0, 3) : null;
        String episode = matcherString != null ? matcherString.substring(3) : null;
        if (baseFolder != null) {
            Map<String, String> map = new HashMap<>();
            if (season != null) {
                map.put("streamFolderFilePath", String.format("%s/%s/%s/%s/%s", normalizePath(DbWorldConstants.STREAM_HOME_PATH), SERIES_FOLDER, baseFolder, season, filePath.getFileName().toString()));
                map.put("recordIdFolder", baseFolder);
                map.put("recordType", DbWorldConstants.RECORD_TYPE_SERIES);
                map.put("season", season);
                map.put("episode", episode);
            } else {
                map.put("streamFolderFilePath", String.format("%s/%s/%s/%s", normalizePath(DbWorldConstants.STREAM_HOME_PATH), MOVIES_FOLDER,  baseFolder, filePath.getFileName().toString()));
                map.put("recordIdFolder", baseFolder);
                map.put("recordType", DbWorldConstants.RECORD_TYPE_MOVIE);
            }
            return Optional.of(map);
        }
        return Optional.empty();
    }

    private Long parseRecordId(String folderName) {
        try {
            return Long.parseLong(folderName.split("-")[0]);
        } catch (NumberFormatException e) {
            throw new DbWorldException("Invalid folder name format, unable to parse recordId: " + folderName, e);
        }
    }

    private void handleFileDeletion(String filePath) {
        try {
            mediaFileInfoService.deleteInfoByFilePath(filePath);
            log.info("File deleted from database: {}", filePath);
        } catch (Exception e) {
            log.error("Error deleting file from database: {}", filePath, e);
        }
    }

    private List<MediaFileInfoEntity> storeMediaInfo(Long recordId, Path sourcePath, String streamFolderFilePath) {
        try {
            String jsonOutput = dbWorldUtils.runMediaInfoCommand(sourcePath);
            return parseMediaInfoJson(jsonOutput, recordId, streamFolderFilePath);
        } catch (Exception e) {
            throw new DbWorldException("Error storing media info for recordId: " + recordId + ", " + e.getMessage());
        }
    }

    private List<MediaFileInfoEntity> parseMediaInfoJson(String jsonOutput, Long recordId, String streamFolderFilePath) {
        try {
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);
            if (jsonElement.isJsonArray()) {
                jsonElement.getAsJsonArray().forEach(element -> mediaFileInfos.add(saveJsonObject(recordId, streamFolderFilePath, element.getAsJsonObject())));
            } else if (jsonElement.isJsonObject()) {
                mediaFileInfos.add(saveJsonObject(recordId, streamFolderFilePath, jsonElement.getAsJsonObject()));
            }
            return mediaFileInfos;
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    private MediaFileInfoEntity saveJsonObject(Long recordId, String streamFolderFilePath, JsonObject jsonObject) {
        try {
            log.info("Converting Json to entity class");
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);
            entity.setFilePath(streamFolderFilePath);
            log.info("Set New Path: {} ", entity.getFilePath());
            log.info("Converted to entity, storing data to db...");
            if (recordId != null) {
                return mediaFileInfoService.save(entity.initialize(dbCinemaRecordsService.getRecordEntityById(recordId)));
            } else {
                return mediaFileInfoService.save(entity);
            }
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", recordId, e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: " + recordId + ", " + e.getMessage());
        }
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfoEntity.class);
        if (mediaFileInfo == null) {
            throw new DbWorldException("Media file details could not be retrieved from JSON");
        }
        return mediaFileInfo;
    }

    private String normalizePath(String path) {
        return path.replace("\\", "/");
    }

    private String createFolderName(String originalName){
        // Replace ": " with "- "
        String safeName = originalName.replace(": ", "- ");
        // Replace other restricted characters with "-"
        return safeName.replaceAll("[:*?\"<>|\\\\/]", "-");
    }
}