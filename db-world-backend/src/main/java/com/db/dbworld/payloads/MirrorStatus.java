package com.db.dbworld.payloads;

import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.db.dbworld.utils.PathSanitizer;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.*;
import lombok.extern.log4j.Log4j2;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Date;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Log4j2
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MirrorStatus {

    private String id = String.valueOf(new Date().getTime());
    private String parentId;
    private Long pid;
    private String gid;
    private String timeStamp = id;
    private Long recordId;
    private String userBy;
    private String folderName;
    private String fileUrl;
    private String urlUsername;
    private String urlPassword;
    private boolean isUrlProtected;
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

    // Thread-safe state management
    private final AtomicReference<MirrorState> currentState = new AtomicReference<>(MirrorState.DOWNLOAD);
    private DownloadStatus downloadStatus;

    private String videoITag;
    private String audioITag;
    private boolean onlyAudio;
    private String message;

    @JsonIgnore
    private transient DbWorldRuntimeProperties runtime;

    // Derived boolean fields based on state
    public boolean isPause() {
        return currentState.get() == MirrorState.PAUSE;
    }

    public boolean isFailed() {
        return currentState.get() == MirrorState.FAILED;
    }

    public boolean isCancelled() {
        return currentState.get() == MirrorState.CANCELLED;
    }

    public boolean isSuccess() {
        return currentState.get() == MirrorState.SUCCESS;
    }

    public boolean isCompleted() {
        MirrorState state = currentState.get();
        return state == MirrorState.SUCCESS || state == MirrorState.FAILED || state == MirrorState.CANCELLED;
    }

    // Thread-safe state transitions
    public boolean transitionTo(MirrorState newState) {
        MirrorState current = currentState.get();
        if (isValidTransition(current, newState)) {
            return currentState.compareAndSet(current, newState);
        }
        return false;
    }

    public boolean transitionTo(MirrorState newState, String message) {
        if (transitionTo(newState)) {
            this.message = message;
            return true;
        }
        return false;
    }

    public boolean isValidTransition(MirrorState current, MirrorState newState) {
        switch (current) {
            case DOWNLOAD:
                return newState == MirrorState.PAUSE || newState == MirrorState.CANCELLED ||
                        newState == MirrorState.FAILED || newState == MirrorState.EXTRACT ||
                        newState == MirrorState.MERGE || newState == MirrorState.FFMPEG;
            case PAUSE:
                return newState == MirrorState.RESUME || newState == MirrorState.CANCELLED;
            case RESUME:
                return newState == MirrorState.DOWNLOAD || newState == MirrorState.PAUSE ||
                        newState == MirrorState.CANCELLED;
            case EXTRACT:
            case MERGE:
            case FFMPEG:
                return newState == MirrorState.SUCCESS || newState == MirrorState.FAILED ||
                        newState == MirrorState.CANCELLED;
            case SUCCESS:
            case FAILED:
            case CANCELLED:
                return false; // Terminal states
            default:
                return false;
        }
    }

    // Getters and setters for state
    public MirrorState getCurrentState() {
        return currentState.get();
    }

    public void setCurrentState(MirrorState state) {
        this.currentState.set(state);
    }

    public String getCurrentStatus() {
        return getStatusDisplay(currentState.get());
    }

    private String getStatusDisplay(MirrorState state) {
        switch (state) {
            case DOWNLOAD: return "Downloading...";
            case EXTRACT: return "Extracting...";
            case MERGE: return "Merging...";
            case FFMPEG: return "Processing Media...";
            case COMPLETE: return "Completed ✅";
            case FAILED: return "Failed ❌";
            case CANCELLED: return "Cancelled 🚮";
            case PAUSE: return "Paused ⏸";
            case RESUME: return "Resumed ▶";
            case SUCCESS: return "Success ✅";
            default: return state.toString();
        }
    }

    // Factory constructor
    public MirrorStatus(
            DbWorldRuntimeProperties runtime,
            String folderName,
            String fileUrl,
            String fileName,
            Long fileSize,
            boolean extract
    ) {
        this.runtime = runtime;
        this.id = String.valueOf(new Date().getTime());
        this.timeStamp = this.id;
        this.folderName = determineFolderName(folderName);
        this.recordId = extractRecordId(folderName);
        this.tempFileName = timeStamp;
        this.currentState.set(MirrorState.DOWNLOAD);
        this.fileUrl = fileUrl;
        this.magnet = isMagnetLink(fileUrl);
        this.fileName = sanitizeFileName(fileName);
        this.fileSize = fileSize;
        this.extract = extract;
        this.isUrlProtected = false;

        initializePaths(this.folderName, this.fileName, this.extract);
        initializeFileType();
        log.info("Created MirrorStatus : {}", this.toJsonString());
    }

    private boolean isMagnetLink(String url) {
        return url != null && (url.toLowerCase().startsWith("magnet:") || url.toLowerCase().endsWith(".torrent"));
    }

    private String determineFolderName(String folderName) {
        return !StringUtils.hasText(folderName) ? "unassigned" : PathSanitizer.sanitizePathComponent(folderName);
    }

    private Long extractRecordId(String folderName) {
        if (!StringUtils.hasText(folderName)) {
            return -1L;
        }
        try {
            return Long.valueOf(folderName.split("-")[0]);
        } catch (NumberFormatException e) {
            log.warn("Invalid record ID in folder name: {}", folderName);
            return -1L;
        }
    }

    private String sanitizeFileName(String fileName) {
        return Optional.ofNullable(fileName)
                .orElse("unknown_file_" + System.currentTimeMillis());
    }

    private void initializePaths(String folderName, String fileName, boolean extract) {
        validateConstants();

        try {
            this.recordIdPath = buildCleanPath(DbWorldConstants.INTEGRATION_FOLDER_PATH, folderName);
            this.tempRecordIdPath = buildCleanPath(DbWorldConstants.TEMP_DOWNLOAD_PATH, folderName);

            this.filePath = buildCleanPath(recordIdPath, fileName);
            this.tempFilePath = buildCleanPath(tempRecordIdPath, tempFileName);

            createDirectories(tempRecordIdPath, recordIdPath);

            if (extract) {
                this.extractedFileName = extractFileName(fileName);
                this.tempExtractedFilePath = buildCleanPath(tempRecordIdPath, extractedFileName);
                this.extractedFilePath = buildCleanPath(recordIdPath, extractedFileName);
            }
        } catch (IOException e) {
            log.error("Failed to initialize paths: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize download paths", e);
        }
    }

    private String buildCleanPath(String base, String... parts) {
        String cleanedBase = StringUtils.cleanPath(base);
        StringBuilder pathBuilder = new StringBuilder(cleanedBase);

        for (String part : parts) {
            if (StringUtils.hasText(part)) {
                String cleanedPart = StringUtils.cleanPath(part);
                pathBuilder.append("/").append(cleanedPart);
            }
        }

        return pathBuilder.toString();
    }

    private void validateConstants() {
        if (!StringUtils.hasText(DbWorldConstants.INTEGRATION_FOLDER_PATH) ||
                "null".equals(DbWorldConstants.INTEGRATION_FOLDER_PATH)) {
            DbWorldConstants.INTEGRATION_FOLDER_PATH = "/ext_hdisk/dbworld/integration/";
            log.warn("Using default integration folder path: {}", DbWorldConstants.INTEGRATION_FOLDER_PATH);
        }
        if (!StringUtils.hasText(DbWorldConstants.TEMP_DOWNLOAD_PATH) ||
                "null".equals(DbWorldConstants.TEMP_DOWNLOAD_PATH)) {
            DbWorldConstants.TEMP_DOWNLOAD_PATH = "/ext_hdisk/dbworld/temp/";
            log.warn("Using default temp download path: {}", DbWorldConstants.TEMP_DOWNLOAD_PATH);
        }
    }

    private void createDirectories(String... paths) throws IOException {
        for (String path : paths) {
            if (StringUtils.hasText(path)) {
                Files.createDirectories(Paths.get(path));
                log.debug("Created directory: {}", path);
            }
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
        if (!StringUtils.hasText(fileName)) {
            return "application/octet-stream";
        }

        String lowerName = fileName.toLowerCase();
        if (lowerName.endsWith(".mp4")) return "video/mp4";
        if (lowerName.endsWith(".mp3")) return "audio/mpeg";
        if (lowerName.endsWith(".pdf")) return "application/pdf";
        if (lowerName.endsWith(".zip")) return "application/zip";
        if (lowerName.endsWith(".rar")) return "application/x-rar-compressed";
        if (lowerName.endsWith(".tar")) return "application/x-tar";
        if (lowerName.endsWith(".7z")) return "application/x-7z-compressed";
        return "application/octet-stream";
    }

    private String extractFileName(String fileName) {
        if (!StringUtils.hasText(fileName)) {
            return "extracted_file";
        }
        return fileName.replaceAll("\\.(zip|rar|tar|7z)$", "");
    }

    public void validatePaths() throws IOException {
        if (!StringUtils.hasText(this.tempFilePath) || !StringUtils.hasText(this.filePath)) {
            throw new IOException("Source or destination path is null or empty");
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
        this.tempFilePath = buildCleanPath(tempRecordIdPath, tempFileName);
    }

    public void setFileName(String fileName) {
        this.fileName = sanitizeFileName(fileName);
        this.filePath = buildCleanPath(recordIdPath, this.fileName);
        if (this.extract) {
            this.extractedFileName = extractFileName(this.fileName);
            this.tempExtractedFilePath = buildCleanPath(tempRecordIdPath, extractedFileName);
            this.extractedFilePath = buildCleanPath(recordIdPath, extractedFileName);
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
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