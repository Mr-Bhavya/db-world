//package com.db.dbworld.handler;
//
//import com.db.dbworld.entities.dbcinema.stream.*;
//import com.db.dbworld.core.exception.DbWorldException;
//import com.db.dbworld.payloads.mediafile.MediaFileDetails;
//import com.db.dbworld.services.media.*;
//import com.db.dbworld.utils.*;
//import com.fasterxml.jackson.core.JsonProcessingException;
//import com.fasterxml.jackson.databind.DeserializationFeature;
//import com.fasterxml.jackson.databind.ObjectMapper;
//import com.google.gson.Gson;
//import com.google.gson.JsonElement;
//import com.google.gson.JsonObject;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.stereotype.Service;
//
//import java.io.File;
//import java.nio.file.*;
//import java.util.*;
//import java.util.regex.Matcher;
//import java.util.regex.Pattern;
//
///**
// * @deprecated Depends on old entities (MediaFileInfoEntity, DBCinemaRecordsEntity) and
// * services (MediaFileInfoService, SystemLinkService, MediaFileNamingService) that are
// * all superseded by the new app.media.* pipeline. Use MediaInfoService +
// * TmdbMediaEnrichmentService + SymlinkService instead.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//@Service("mediaFileHandler")
//public class MediaFileHandler {
//
//    @Autowired
//    private MediaFileInfoService mediaFileInfoService;
//
//    @Autowired
//    private SystemLinkService systemLinkService;
//
//    @Autowired
//    private DbWorldUtils dbWorldUtils;
//
//    @Autowired
//    private MediaFileNamingService mediaFileNamingService;
//
//    @Autowired
//    private MediaFileUtils mediaFileUtils;
//
//    @Autowired
//    private MediaInfoCommandService mediaInfoCommandService;
//
//    private static final String UNASSIGNED_FOLDER = "unassigned";
//
//    private static final Pattern SEASON_EPISODE_PATTERN = Pattern.compile("([sS]\\d{2}[eE]\\d{2})");
//
//    private final ObjectMapper objectMapper;
//
//    public MediaFileHandler() {
//        this.objectMapper = new ObjectMapper();
//        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
//    }
//
//    public void processFile(File file) {
//        try {
//            Path path = file.toPath();
//            boolean isUnassigned = path.toString().contains(UNASSIGNED_FOLDER);
//
//            if (isUnassigned) {
//                processUnassignedFile(file);
//            } else {
//                processAssignedFile(file);
//            }
//        } catch (Exception e) {
//            log.error("Error processing file: {}, {}", file, e.getLocalizedMessage());
//        }
//    }
//
//    public void processUnassignedFile(File file) {
//        try {
//            String sourceFile = file.getPath();
//            Path sourceFilePath = file.toPath();
//
//            if (!file.exists()) {
//                log.info("File not found, skipping: {}", file.getAbsolutePath());
//                return;
//            }
//
//            String relativePath = extractRelativePathAfterUnassigned(sourceFile);
//            String seasonEpisode = extractSeasonEpisode(relativePath);
//
//            String targetPath = buildUnassignedTargetPath(sourceFilePath, relativePath, seasonEpisode);
//            dbWorldUtils.moveFileOrDir(sourceFile, targetPath, true);
//            log.info("Moved unassigned file from {} to {}", sourceFile, targetPath);
//        } catch (Exception e) {
//            log.error("Error processing unassigned file: {}, {}", file, e.getLocalizedMessage());
//        }
//    }
//
//    private String extractRelativePathAfterUnassigned(String sourceFile) {
//        String relativePath = sourceFile.substring(sourceFile.indexOf(UNASSIGNED_FOLDER) + UNASSIGNED_FOLDER.length() + 1);
//        return normalizePath(relativePath);
//    }
//
//    private String buildUnassignedTargetPath(Path sourceFilePath, String relativePath, String seasonEpisode) {
//        if (seasonEpisode != null) {
//            String seriesName = extractSeriesName(relativePath);
//            String season = seasonEpisode.substring(0, 3);
//            return String.format("%s/%s/%s/%s/%s",
//                    normalizePath(DbWorldConstants.STREAM_HOME_PATH),
//                    UNASSIGNED_FOLDER,
//                    seriesName,
//                    season,
//                    sourceFilePath.getFileName().toString());
//        } else {
//            return String.format("%s/%s/%s",
//                    normalizePath(DbWorldConstants.STREAM_HOME_PATH),
//                    UNASSIGNED_FOLDER,
//                    sourceFilePath.getFileName().toString());
//        }
//    }
//
//    private String extractSeasonEpisode(String path) {
//        Matcher matcher = SEASON_EPISODE_PATTERN.matcher(path);
//        return matcher.find() ? matcher.group().toUpperCase() : null;
//    }
//
//    private String extractSeriesName(String path) {
//        path = normalizePath(path);
//        int seasonIndex = path.toLowerCase().indexOf("s0");
//        if (seasonIndex == -1) return "Unknown";
//
//        String[] parts = path.substring(0, seasonIndex).split("/");
//        String seriesName = parts[parts.length - 1];
//        return seriesName.replaceAll("[^a-zA-Z0-9 .'-]", "");
//    }
//
//    private void processAssignedFile(File file) {
//        try {
//            MediaFileDetails fileDetails = mediaFileUtils.createMediaFileDetails(file.getPath())
//                    .orElseThrow(() -> new DbWorldException("Unable to create MediaFileDetails objects from folder path: " + file.getPath()));
//
//            if (file.exists()) {
//                processExistingAssignedFile(file, fileDetails);
//            } else {
//                handleFileDeletion(file.getAbsolutePath());
//            }
//        } catch (Exception e) {
//            log.error("Error processing assigned file: {}, {}", file, e.getLocalizedMessage());
//        }
//    }
//
//    public void processExistingAssignedFile(File file, MediaFileDetails fileDetails) {
//        String sourcePath = file.getPath();
//        List<MediaFileInfoEntity> mediaFileInfoEntities = getMediaFileInfo(fileDetails, file.toPath());
//
//        mediaFileInfoEntities.forEach(mediaFileInfoEntity -> {
//            mediaFileInfoEntity = mediaFileInfoService.save(mediaFileInfoEntity);
//            dbWorldUtils.moveFileOrDir(sourcePath, mediaFileInfoEntity.getFilePath(), true);
//            systemLinkService.create(mediaFileInfoEntity);
//        });
//
//        log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), fileDetails.getRecordId());
//    }
//
//    private void handleFileDeletion(String filePath) {
//        try {
//            mediaFileInfoService.deleteInfoByFilePath(filePath);
//            log.info("File deleted from database: {}", filePath);
//        } catch (Exception e) {
//            log.error("Error deleting file from database: {}", filePath, e);
//        }
//    }
//
//    private List<MediaFileInfoEntity> getMediaFileInfo(MediaFileDetails fileDetails, Path sourcePath) {
//        try {
//            String jsonOutput = mediaInfoCommandService.modifyAndFilterTracksAndTitles(sourcePath, fileDetails);
////            return mediaInfoUtils.parseMediaInfoJson(fileDetails, jsonOutput);
//            return parseMediaInfoJson(fileDetails, jsonOutput);
//        } catch (Exception e) {
//            throw new DbWorldException("Error storing media info for recordId: " + fileDetails.getRecordId(), e);
//        }
//    }
//
//    private List<MediaFileInfoEntity> parseMediaInfoJson(MediaFileDetails fileDetails, String jsonOutput) {
//        try {
//            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);
//            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();
//
//            if (jsonElement.isJsonArray()) {
//                jsonElement.getAsJsonArray().forEach(element ->
//                        mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, element.getAsJsonObject())));
//            } else if (jsonElement.isJsonObject()) {
//                mediaFileInfos.add(jsonObjectToMediaFileInfoEntity(fileDetails, jsonElement.getAsJsonObject()));
//            }
//
//            return mediaFileInfos;
//        } catch (Exception ex) {
//            throw new DbWorldException("Error parsing media info JSON", ex);
//        }
//    }
//
//    private MediaFileInfoEntity jsonObjectToMediaFileInfoEntity(MediaFileDetails fileDetails, JsonObject jsonObject) {
//        try {
//            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject);
//
//            if (fileDetails.getRecordId() != null) {
//                entity = entity.initialize(fileDetails.getDbCinemaRecordsEntity());
//                String fileName = mediaFileNamingService.buildFileNameAndPath(fileDetails, entity);
//                entity.setFileName(fileName);
//                entity.setFilePath(Path.of(Path.of(fileDetails.getStreamFilePath()).getParent().toString(), fileName).toString());
//            }
//
//            return entity;
//        } catch (Exception e) {
//            log.error("Error parsing media info JSON for recordId: {}, {}", fileDetails.getRecordId(), e.getMessage());
//            throw new DbWorldException("Error parsing media info JSON for recordId: " + fileDetails.getRecordId(), e);
//        }
//    }
//
//    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
//        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(jsonObject.get("media").toString(), MediaFileInfoEntity.class);
//        if (mediaFileInfo == null) {
//            throw new DbWorldException("Media file details could not be retrieved from JSON");
//        }
//        return mediaFileInfo;
//    }
//
//    private String normalizePath(String path) {
//        return path.replace("\\", "/");
//    }
//}