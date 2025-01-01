package com.db.dbworld.services.Impl;

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
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.FileSystem;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Log4j2
@Service
public class FileHandlerServiceImpl {

    //    @Value("${dbworld.paths.streamHomePath}")
    private static final String INPUT_DIRECTORY = "D:/Bhavya/ProcessedVideos";

    @Autowired
    private MediaFileInfoRepository mediaFileInfoRepository;

    @Autowired
    private DBCinemaRecordsService dbCinemaRecordsService;

    public void processFile(File file) {
        try {
            String folderName = extractBaseFolder(file.getPath());
            if(folderName == null){
                throw new DbWorldException("Not able to retrieve the recordId from folder");
            }
            Long recordId = Long.parseLong(folderName.split("-")[0]);
            if (file.exists()) {
                // File created or modified
                List<MediaFileInfoEntity> mediaFileInfoEntities = storeMediaInfo(recordId, file.toPath());
                log.info("Total files processed - {}", mediaFileInfoEntities.size());
            } else {
                // File deleted
//                mediaFileInfoRepository.deleteByPath(file.getAbsolutePath());
                System.out.println("File deleted from database: " + file.getAbsolutePath());
            }
        } catch (Exception e) {
            log.error(e.getMessage());
        }
    }

    public static String extractBaseFolder(String filePath) {
        // Normalize paths to use forward slashes for consistency
        filePath = filePath.replace("\\", "/");

        // Define the base directory where your target folders are located
        String baseDirectory = INPUT_DIRECTORY.replace("\\", "/");

        // Define a regex pattern to match "<number>-<name>"
        String pattern = "\\d+-[a-zA-Z0-9 ]+";

        // Ensure the path starts with the base directory
        if (!filePath.startsWith(baseDirectory)) {
            return null; // Return null if the path is invalid
        }

        // Extract the portion of the path after the base directory
        String relativePath = filePath.substring(baseDirectory.length());

        // Use regex to find the first occurrence of the pattern
        Pattern regex = Pattern.compile(pattern);
        Matcher matcher = regex.matcher(relativePath);

        if (matcher.find()) {
            return matcher.group(); // Return the matched folder name
        }

        return null; // Return null if no match is found
    }

    private List<MediaFileInfoEntity> storeMediaInfo(Long recordId, Path path) {
        try {
//            Long recordId = Long.parseLong(path.getFileName().toString().split("-")[0]);

            LinkedList<String> list = new LinkedList<>();
            list.add("D:\\Bhavya\\Downloads\\Compressed\\MediaInfo_CLI_24.12_Windows_x64\\mediainfo");
            list.add("--Output=JSON");
            list.add(path.toString());
            // Run mediainfo command
            ProcessBuilder processBuilder = new ProcessBuilder();
            processBuilder.command(list);
            Process process = processBuilder.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
            process.waitFor();
            List<MediaFileInfoEntity> mediaFileInfos = new ArrayList<>();

            JsonElement outputJsonElement = new Gson().fromJson(output.toString(), JsonElement.class);
            if (outputJsonElement.isJsonArray()) {
                outputJsonElement.getAsJsonArray().asList().forEach(
                        jsonElement -> {
                            if (jsonElement.isJsonObject()) {
                                MediaFileInfoEntity mediaFileInfo = null;
                                try {
                                    mediaFileInfo = convertJsonObjectToMediaInfo(jsonElement.getAsJsonObject());
                                    mediaFileInfos.add(mediaFileInfoRepository.save(mediaFileInfo.initialize(dbCinemaRecordsService.getRecordEntityById(recordId))));
                                } catch (Exception e) {
                                    throw new DbWorldException(e.getMessage());
                                }
                            }
                        }
                );
            } else if (outputJsonElement.isJsonObject()) {
                MediaFileInfoEntity mediaFileInfo = convertJsonObjectToMediaInfo(outputJsonElement.getAsJsonObject());
                mediaFileInfos.add(mediaFileInfoRepository.save(mediaFileInfo.initialize(dbCinemaRecordsService.getRecordEntityById(recordId))));
            }
            return mediaFileInfos;
        } catch (Exception ex) {
            throw new DbWorldException(ex.getMessage());
        }
    }

    private MediaFileInfoEntity convertJsonObjectToMediaInfo(JsonObject jsonObject) throws JsonProcessingException {
        String media = jsonObject.get("media").toString();
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        MediaFileInfoEntity mediaFileInfo = objectMapper.readValue(media, MediaFileInfoEntity.class);
        if (mediaFileInfo == null) {
            throw new DbWorldException("Not able to fetch details for media file");
        }
        return mediaFileInfo;
    }
}
