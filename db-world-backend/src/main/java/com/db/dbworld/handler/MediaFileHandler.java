package com.db.dbworld.handler;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.DBCinemaRecordsService;
import com.db.dbworld.utils.DbWorldUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Log4j2
@Service("mediaFileHandler")
public class MediaFileHandler {

    @Value("${dbworld.paths.integrationFolderPath}")
    private String integrationFolderPath;

    @Value("${dbworld.paths.streamHomePath}")
    private String streamHomePath;

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    @Autowired
    private DbWorldUtils dbWorldUtils;

    public void processFile(File file) {
        try {
            // Extract details from the file path
            Map<String, String> map = extractBaseFolder(file.getPath());
            if (map == null) {
                throw new DbWorldException("Unable to retrieve recordId from folder path: " + file.getPath());
            }

            Long recordId = parseRecordId(map.get("folderName"));
            String sourcePath = file.getPath();
            String targetFolder = streamHomePath+ File.separator + map.get("folderName");

            if (file.exists()) {
                // File created or modified
                List<MediaFileInfoEntity> mediaFileInfoEntities = storeMediaInfo(recordId, file.toPath());
                moveFileToDirectory(sourcePath, targetFolder);
                log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), recordId);
            } else {
                // File deleted
                handleFileDeletion(file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error("Error processing file: {}, {}", file, e.getLocalizedMessage());
        }
    }

    private Map<String, String> extractBaseFolder(String filePath) {
        filePath = normalizePath(filePath);
        String baseDirectory = normalizePath(integrationFolderPath);

        if (!filePath.startsWith(baseDirectory)) {
            return null;
        }

        String relativePath = filePath.substring(baseDirectory.length());
        String folderName = relativePath.split("/")[0];
        String pattern = "\\d+-[a-zA-Z0-9 ]+";

        Matcher matcher = Pattern.compile(pattern).matcher(folderName);
        if (matcher.find()) {
            Map<String, String> map = new HashMap<>();
            map.put("filePath", getStreamFolderFilePath(filePath));
            map.put("folderName", matcher.group());
            return map;
        }

        return null;
    }

    private Long parseRecordId(String folderName) {
        try {
            return Long.parseLong(folderName.split("-")[0]);
        } catch (NumberFormatException e) {
            throw new DbWorldException("Invalid folder name format, unable to parse recordId: " + folderName, e);
        }
    }

    private void moveFileToDirectory(String sourcePath, String targetFolder) {
        try {
            FileUtils.moveToDirectory(new File(sourcePath), new File(targetFolder), true);
            log.info("Moved file to directory: {}", targetFolder);
        } catch (IOException e) {
            throw new DbWorldException("Error moving file to directory: " + targetFolder, e);
        }
    }

    private void handleFileDeletion(String filePath) {
        try {
            // Uncomment below to handle database deletion
            // mediaFileInfoRepository.deleteByPath(filePath);
            log.info("File deleted from database: {}", filePath);
        } catch (Exception e) {
            log.error("Error deleting file from database: {}", filePath, e);
        }
    }

    private List<MediaFileInfoEntity> storeMediaInfo(Long recordId, Path path) {
        try {
            String jsonOutput = dbWorldUtils.runMediaInfoCommand(path);
            return parseMediaInfoJson(jsonOutput, recordId);
        } catch (Exception e) {
            throw new DbWorldException("Error storing media info for recordId: " + recordId + ", " + e.getMessage());
        }
    }

    private List<MediaFileInfoEntity> parseMediaInfoJson(String jsonOutput, Long recordId) {
        try {
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();
            JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);

            if(jsonElement.isJsonArray()){
                jsonElement.getAsJsonArray().forEach(element -> {
                    mediaFileInfos.add(saveJsonObject(recordId, element.getAsJsonObject()));
                });
            }else if(jsonElement.isJsonObject()) {
                mediaFileInfos.add(saveJsonObject(recordId, jsonElement.getAsJsonObject()));
            }
            return mediaFileInfos;
        }catch (Exception ex){
            throw new DbWorldException(ex.getMessage());
        }
    }

    private MediaFileInfoEntity saveJsonObject(Long recordId, JsonObject jsonObject){
        try {
            log.info("Converting Json to entity class");
            MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(jsonObject.getAsJsonObject());
            entity.setFilePath(getStreamFolderFilePath(entity.getFilePath()));
            log.info("Set New Path: {} ", entity.getFilePath());
            log.info("Converted to entity, storing data to db...");
            return mediaFileInfoRepository.save(entity.initialize(dbCinemaRecordsService.getRecordEntityById(recordId)));
        } catch (Exception e) {
            log.error("Error parsing media info JSON for recordId: {}, {}", recordId, e.getMessage());
            throw new DbWorldException("Error parsing media info JSON for recordId: "+ recordId + ", "+e.getMessage());
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

    private String getStreamFolderFilePath(String integrationFolderFilePath){
        String baseDirectory = normalizePath(integrationFolderPath);
        String streamDirectory = normalizePath(streamHomePath+File.separator);
        if(integrationFolderFilePath != null){
            return normalizePath(integrationFolderFilePath).replace(baseDirectory, streamDirectory);
        }
        return null;
    }

}
