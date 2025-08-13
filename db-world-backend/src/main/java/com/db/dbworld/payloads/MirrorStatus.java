package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.Date;
import java.util.Optional;
import java.util.stream.Collectors;

@Log4j2
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Service
public class MirrorStatus {

    private String id = String.valueOf(new Date().getTime());
    private Long pid;
    private String gid;
    private String timeStamp = id;
    private Long recordId;
    private String userBy;
    private String folderName;
    private String fileUrl;
    private boolean magnet;
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
        this.folderName = determineFolderName(folderName);
        this.recordId = extractRecordId(folderName);
        this.tempFileName = timeStamp;
        this.currentStatus = "Downloading ...";
        this.fileUrl = fileUrl;
        this.magnet = isMagnetLink(fileUrl);
        this.fileName = sanitizeFileName(fileName);
        this.fileSize = fileSize;
        this.extract = extract;

        initializePaths(this.folderName, this.fileName, this.extract);
        initializeFileType();
        log.info("Updated MirrorStatus : {}", this.toJsonString());
    }

    public MirrorStatus(String folderName, String fileUrl, String fileName, Long fileSize,
                        boolean extract, String videoITag, String audioITag, boolean onlyAudio) {
        this(folderName, fileUrl, fileName, fileSize, extract);
        this.videoITag = videoITag;
        this.audioITag = audioITag;
        this.onlyAudio = onlyAudio;
    }

    private boolean isMagnetLink(String url) {
        return url != null && (url.toLowerCase().startsWith("magnet:") || url.toLowerCase().endsWith(".torrent"));
    }

    private String determineFolderName(String folderName) {
        return (folderName == null || folderName.isEmpty()) ? "unassigned" : folderName;
    }

    private Long extractRecordId(String folderName) {
        try {
            if (folderName != null && !folderName.isEmpty()) {
                return Long.valueOf(folderName.split("-")[0]);
            }
        } catch (NumberFormatException e) {
            log.warn("Invalid record ID in folder name: {}", folderName);
        }
        return -1L;
    }

    private String sanitizeFileName(String fileName) {
        return Optional.ofNullable(fileName)
                .map(name -> name.replaceAll("[\\\\/:*?\"<>|]", "_"))
                .orElse("unknown_file_" + System.currentTimeMillis());
    }

    private void initializePaths(String folderName, String fileName, boolean extract) {
        validateConstants();

        try {
            this.recordIdPath = buildPath(DbWorldConstants.INTEGRATION_FOLDER_PATH, folderName);
            this.tempRecordIdPath = buildPath(DbWorldConstants.TEMP_DOWNLOAD_PATH, folderName);

            this.filePath = buildPath(recordIdPath, fileName);
            this.tempFilePath = buildPath(tempRecordIdPath, tempFileName);

            createDirectories(tempRecordIdPath, recordIdPath);

            if (extract) {
                this.extractedFileName = extractFileName(fileName);
                this.tempExtractedFilePath = buildPath(tempRecordIdPath, extractedFileName);
                this.extractedFilePath = buildPath(recordIdPath, extractedFileName);
            }
        } catch (IOException e) {
            log.error("Failed to initialize paths: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize download paths", e);
        }
    }

    private String buildPath(String base, String... parts) {
        String[] safeParts = Arrays.stream(parts)
                .map(p -> p.replaceAll("[\\\\/:*?\"<>|]", "-")) // replace illegal chars with _
                .toArray(String[]::new);

        String path = Paths.get(base, safeParts).toString();
        log.info("Build Path: {}, Base: {}, parts: {}", path, base, String.join("-", safeParts));
        return path;
    }


    private void validateConstants() {
        if (DbWorldConstants.INTEGRATION_FOLDER_PATH == null || DbWorldConstants.INTEGRATION_FOLDER_PATH.equals("null")) {
            DbWorldConstants.INTEGRATION_FOLDER_PATH = "/ext_hdisk/dbworld/integration/";
            log.warn("Using default integration folder path: {}", DbWorldConstants.INTEGRATION_FOLDER_PATH);
        }
        if (DbWorldConstants.TEMP_DOWNLOAD_PATH == null || DbWorldConstants.TEMP_DOWNLOAD_PATH.equals("null")) {
            DbWorldConstants.TEMP_DOWNLOAD_PATH = "/ext_hdisk/dbworld/temp/";
            log.warn("Using default temp download path: {}", DbWorldConstants.TEMP_DOWNLOAD_PATH);
        }
    }

    private void createDirectories(String... paths) throws IOException {
        for (String path : paths) {
            Files.createDirectories(Paths.get(path));
            log.debug("Created directory: {}", path);
        }
    }

    private void initializeFileType() {
        try {
            this.fileType = Files.probeContentType(Paths.get(this.fileName));
            if (this.fileType == null) {
                this.fileType = detectFileTypeByExtension(this.fileName);
            }
        } catch (IOException | InvalidPathException e) {
            log.warn("Failed to detect file type for {}: {}", this.fileName, e.getMessage());
            this.fileType = "application/octet-stream";
        }
    }

    private String detectFileTypeByExtension(String fileName) {
        if (fileName == null) return "application/octet-stream";

        String lowerName = fileName.toLowerCase();
        if (lowerName.endsWith(".mp4")) return "video/mp4";
        if (lowerName.endsWith(".mp3")) return "audio/mpeg";
        if (lowerName.endsWith(".pdf")) return "application/pdf";
        if (lowerName.endsWith(".zip")) return "application/zip";
        if (lowerName.endsWith(".rar")) return "application/x-rar-compressed";
        return "application/octet-stream";
    }

    private String extractFileName(String fileName) {
        return fileName.replaceAll("\\.(zip|rar|tar|7z)$", "");
    }

    public void validatePaths() throws IOException {
        if (this.tempFilePath == null || this.filePath == null) {
            throw new IOException("Source or destination path is null");
        }

        Path source = Paths.get(this.tempFilePath);
        if (!Files.exists(source)) {
            throw new IOException("Source file does not exist: " + this.tempFilePath);
        }

        Path destParent = Paths.get(this.filePath).getParent();
        if (destParent != null && !Files.exists(destParent)) {
            Files.createDirectories(destParent);
        }
    }

    public boolean isFileReadyForMove() {
        try {
            Path source = Paths.get(this.tempFilePath);
            return Files.exists(source) && Files.size(source) > 0;
        } catch (IOException e) {
            log.error("Error checking file readiness: {}", e.getMessage());
            return false;
        }
    }

    public void setTempFileName(String tempFileName) {
        this.tempFileName = tempFileName;
        this.tempFilePath = buildPath(tempRecordIdPath, tempFileName);
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

        public DownloadStatus(Double speed, Long eta, Long fileDownloaded, Long totalFileSize) {
            this.speed = speed;
            this.eta = eta;
            this.fileDownloaded = fileDownloaded;
            this.totalFileSize = totalFileSize;
            this.fileRemaining = (fileDownloaded != null && totalFileSize != null)
                    ? Math.max(0, totalFileSize - fileDownloaded)
                    : 0;
        }
    }

    @JsonIgnore
    public String toJsonString() {
        try {
            return new ObjectMapper()
                    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
                    .writeValueAsString(this);
        } catch (JsonProcessingException e) {
            log.warn("Failed to convert MirrorStatus to JSON: {}", e.getMessage());
            return this.toString();
        }
    }
}