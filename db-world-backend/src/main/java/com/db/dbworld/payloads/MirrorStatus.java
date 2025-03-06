package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import lombok.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Date;
import java.util.Optional;

@Log4j2
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Service
public class MirrorStatus {

    private String id = String.valueOf(new Date().getTime());
    private String timeStamp = id;
    private Long recordId;
    private String userBy;
    private String folderName;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String filePath;
    private String recordIdPath;
    private boolean extract;
    private String extractedFileName;
    private String extractedFilePath;
    private String tempFileName = timeStamp;
    private String tempFilePath;
    private String tempExtractedFilePath;
    private String tempRecordIdPath;
    private String statusFilePath;
    private Long fileSize;
    private String currentStatus = "Downloading ...";
    private DownloadStatus downloadStatus;
    private String videoITag;
    private String audioITag;
    private boolean onlyAudio;
    private boolean pause;
    private boolean failed;
    private boolean cancelled;
    private boolean success;
    private boolean completed;
    private String message;

    public MirrorStatus(String folderName, String fileUrl, String fileName, Long fileSize, boolean extract) {
        this.id = String.valueOf(new Date().getTime());
        this.timeStamp = this.id;

        // Determine folder name (default: "unassigned" if null/empty)
        this.folderName = determineFolderName(folderName);

        // Extract recordId from folderName
        this.recordId = extractRecordId(folderName);

        this.tempFileName = timeStamp;
        this.currentStatus = "Downloading ...";
        this.fileUrl = fileUrl;
        this.fileName = sanitizeFileName(fileName);
        this.fileSize = fileSize;

        if (DbWorldConstants.INTEGRATION_FOLDER_PATH == null || DbWorldConstants.INTEGRATION_FOLDER_PATH.equals("null")) {
            log.warn("integrationFolderPath is null");
            DbWorldConstants.INTEGRATION_FOLDER_PATH = "/ext_hdisk/dbworld/integration/";
        }

        // Updated paths to handle "unassigned" folder
        this.recordIdPath = DbWorldConstants.INTEGRATION_FOLDER_PATH + File.separator + this.folderName;
        this.tempRecordIdPath = DbWorldConstants.TEMP_DOWNLOAD_PATH + this.folderName;
        this.filePath = recordIdPath + File.separator + sanitizeFileName(fileName);
        this.tempFilePath = tempRecordIdPath + File.separator + tempFileName;

        this.extract = extract;

        try {
            this.fileType = Files.probeContentType(Path.of(sanitizeFileName(fileName)));
            Files.createDirectories(Path.of(tempRecordIdPath));
            Files.createDirectories(Path.of(recordIdPath));
        } catch (IOException | InvalidPathException e) {
            log.error("Error creating directories: {}", e.getMessage());
        }

        if (extract) {
            this.extractedFileName = extractFileName(this.fileName);
            this.tempExtractedFilePath = tempRecordIdPath + File.separator + extractedFileName;
            this.extractedFilePath = recordIdPath + File.separator + extractedFileName;
        }
    }

    public MirrorStatus(String folderName, String fileUrl, String fileName, Long fileSize, boolean extract, String videoITag, String audioITag, boolean onlyAudio) {
        this(folderName, fileUrl, fileName, fileSize, extract);
        this.videoITag = videoITag;
        this.audioITag = audioITag;
        this.onlyAudio = onlyAudio;
    }

    private String determineFolderName(String folderName) {
        if (folderName == null || folderName.isEmpty()) {
            return "unassigned"; // Separate folder for null/empty records
        }
        return folderName;
    }

    private Long extractRecordId(String folderName) {
        try {
            if (folderName != null && !folderName.isEmpty()) {
                return Long.valueOf(folderName.split("-")[0]);
            }
        } catch (NumberFormatException e) {
            log.warn("Invalid record ID in folder name: {}", folderName);
        }
        return -1L; // Default recordId for null or invalid values
    }

    private String sanitizeFileName(String fileName) {
        return Optional.ofNullable(fileName)
                .map(name -> name.replaceAll("[|/\\\\]", ""))
                .orElse("unknown_file");
    }


    private String initRecordIdPath(String folderName) {
        if (DbWorldConstants.INTEGRATION_FOLDER_PATH == null || "null".equals(DbWorldConstants.INTEGRATION_FOLDER_PATH)) {
            log.warn("integrationFolderPath is null, using default");
            DbWorldConstants.INTEGRATION_FOLDER_PATH = "/ext_hdisk/dbworld/integration/";
        }
        return Paths.get(DbWorldConstants.INTEGRATION_FOLDER_PATH, folderName).toString();
    }

    private String detectFileType(String fileName) {
        try {
            return Files.probeContentType(Paths.get(fileName));
        } catch (IOException | InvalidPathException e) {
            log.error("Failed to detect file type for {}: {}", fileName, e.getMessage());
            return "unknown";
        }
    }

    private String extractFileName(String fileName) {
        return fileName.replaceAll("\\.(zip|rar|tar|7z)$", "");
    }

    private void createDirectories(String... paths) {
        for (String path : paths) {
            try {
                Files.createDirectories(Paths.get(path));
            } catch (IOException e) {
                log.error("Failed to create directory {}: {}", path, e.getMessage());
            }
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DownloadStatus {
        private Double speed;
        private long fileDownloaded;
        private long fileRemaining;
        private long eta;
        private long totalFileSize;
        private long updateTime;
        private long lastDownloadedBytes;

        public DownloadStatus(long fileDownloaded, long totalFileSize) {
            this.fileDownloaded = fileDownloaded;
            this.totalFileSize = totalFileSize;
            this.fileRemaining = Math.max(0, totalFileSize - fileDownloaded);
        }
    }
}
