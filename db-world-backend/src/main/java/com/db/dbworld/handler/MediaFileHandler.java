package com.db.dbworld.handler;

import com.db.dbworld.dao.dbcinema.stream.MediaFileInfoRepository;
import com.db.dbworld.entities.dbcinema.stream.MediaFileInfoEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.DBCinemaRecordsService;
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
                moveFileToDirectory(sourcePath, targetFolder);
                List<MediaFileInfoEntity> mediaFileInfoEntities = storeMediaInfo(recordId, Path.of(map.get("filePath")));
                log.info("Processed {} files for recordId: {}", mediaFileInfoEntities.size(), recordId);
            } else {
                // File deleted
                handleFileDeletion(file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error("Error processing file: {}", file.getName(), e);
        }
    }

    private Map<String, String> extractBaseFolder(String filePath) {
        filePath = normalizePath(filePath);
        String baseDirectory = normalizePath(integrationFolderPath);
        String streamDirectory = normalizePath(streamHomePath+File.separator);

        if (!filePath.startsWith(baseDirectory)) {
            return null;
        }

        String relativePath = filePath.substring(baseDirectory.length());
        String folderName = relativePath.split("/")[0];
        String pattern = "\\d+-[a-zA-Z0-9 ]+";

        Matcher matcher = Pattern.compile(pattern).matcher(folderName);
        if (matcher.find()) {
            Map<String, String> map = new HashMap<>();
            map.put("filePath", filePath.replace(baseDirectory, streamDirectory));
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
            String jsonOutput = runMediaInfoCommand(path);
            return parseMediaInfoJson(jsonOutput, recordId);
        } catch (Exception e) {
            throw new DbWorldException("Error storing media info for recordId: " + recordId, e);
        }
    }

    private String runMediaInfoCommand(Path path) throws IOException, InterruptedException {
        List<String> command = Arrays.asList(
                "mediainfo",
                "--Output=JSON",
                path.toString()
        );

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        Process process = processBuilder.start();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
            process.waitFor();
            return output.toString();
        }
    }

    private List<MediaFileInfoEntity> parseMediaInfoJson(String jsonOutput, Long recordId) throws JsonProcessingException {
        List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();
        JsonElement jsonElement = new Gson().fromJson(jsonOutput, JsonElement.class);

        if (jsonElement.isJsonObject() || jsonElement.isJsonArray()) {
            jsonElement.getAsJsonArray().forEach(element -> {
                try {
                    MediaFileInfoEntity entity = convertJsonObjectToMediaInfo(element.getAsJsonObject());
                    mediaFileInfos.add(mediaFileInfoRepository.save(entity.initialize(dbCinemaRecordsService.getRecordEntityById(recordId))));
                } catch (Exception e) {
                    log.error("Error parsing media info JSON for recordId: {}", recordId, e);
                }
            });
        }

        return mediaFileInfos;
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

}
