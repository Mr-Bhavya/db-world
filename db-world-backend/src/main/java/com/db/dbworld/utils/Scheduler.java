package com.db.dbworld.utils;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.MediaFileInfoService;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

@Log4j2
@Service
public class Scheduler {

    @Autowired
    private MediaFileInfoService mediaFileInfoService;

    @Scheduled(fixedRate = 1000*60*30) // Every 30 minutes (in milliseconds)
    public void checkMediaFilePath() {
        log.info("CheckMediaFilePath scheduler is start.");
        AtomicInteger noOfDeletedFiles = new AtomicInteger();
        List<Map<String, String>> filePaths = mediaFileInfoService.getAllFilePath();

        if (filePaths == null || filePaths.isEmpty()) {
            log.warn("FilePath list is empty");
            return;
        }

        log.info("Media Files Paths are loaded from database. Total number of file paths: {}", filePaths.size());

        filePaths.forEach(fileInfo -> {

            if (!fileInfo.containsKey("filePath") || !fileInfo.containsKey("id") || !fileInfo.containsKey("fileSize")) {
                log.warn("Not able to retrieve keys id and filePath: {}", fileInfo);
                return;
            }

            String filePath = fileInfo.get("filePath");
            String id = fileInfo.get("id");
            File file = new File(filePath);

            boolean fileShouldBeDeleted = !file.exists() || isFileSizeMismatch(file, String.valueOf(fileInfo.get("fileSize")));

            if (fileShouldBeDeleted) {
                mediaFileInfoService.deleteInfoById(id);
                noOfDeletedFiles.getAndIncrement();
                log.info("{} is deleted successfully from database due to path not being available", filePath);
            }
        });
        log.info("Number of media file paths is deleted: {}", noOfDeletedFiles.get());
        log.info("CheckMediaFilePath scheduler is end.");
    }

    private boolean isFileSizeMismatch(File file, String expectedFileSize) {
        try {
            long actualFileSize = Files.size(file.toPath());
            return !Long.toString(actualFileSize).equalsIgnoreCase(expectedFileSize);
        } catch (IOException e) {
            log.error("Error checking file size for {}: {}", file.getPath(), e.getMessage());
            throw new DbWorldException(e.getMessage());
        }
    }
}
