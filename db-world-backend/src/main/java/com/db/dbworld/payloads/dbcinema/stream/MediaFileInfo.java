package com.db.dbworld.payloads.dbcinema.stream;

import com.db.dbworld.entities.dbcinema.DBCinemaRecordsEntity;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.utils.DbWorldConstants;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.DigestUtils;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Getter
@Setter
@Log4j2
@JsonIgnoreProperties(ignoreUnknown = true)
public class MediaFileInfo {
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")
                    .withZone(ZoneId.systemDefault());

    private String id;
    private Long dbCinemaRecordId;
    private String fileName;
    private Long fileSize;
    private String fileType;
    private String createdDate;
    private String modifiedDate;
    private String mimeType;

    @JsonProperty("@ref")
    private String filePath;

    @JsonProperty("track")
    private List<TrackInfo> trackInfos;

    @PostConstruct
    public MediaFileInfo initialize() {
        if (this.filePath != null) {
            try {
                Path path = Paths.get(filePath).toAbsolutePath();

                // Normalize path
                this.filePath = normalizePath(path);

                // Set basic file info
                this.fileName = path.getFileName().toString();
                this.fileType = getFileExtension(fileName);

                // Get file attributes
                BasicFileAttributes attrs = Files.readAttributes(path, BasicFileAttributes.class);
                this.fileSize = attrs.size();
                this.createdDate = formatDate(attrs.creationTime().toInstant());
                this.modifiedDate = formatDate(attrs.lastModifiedTime().toInstant());

                // Generate ID
                this.id = generateFileId(path);

                // Detect MIME type
                this.mimeType = detectMimeType(path);

            } catch (IOException e) {
                log.error("Failed to initialize MediaFileInfo for path: {}", filePath, e);
                throw new DbWorldException("Failed to initialize file information", e);
            }
        }
        return this;
    }

    private String normalizePath(Path path) {
        return path.toString()
                .replace("\\", "/")
                .replace(DbWorldConstants.STREAM_HOME_PATH, "")
                .replace(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH, "");
    }

    private String generateFileId(Path path) {
        return DigestUtils.md5DigestAsHex(
                (path.toString() + fileSize + modifiedDate).getBytes()
        );
    }

    private String formatDate(Instant instant) {
        return DATE_FORMATTER.format(instant);
    }

    private String getFileExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase(Locale.ROOT) : "";
    }

    private String detectMimeType(Path path) {
        try {
            return Files.probeContentType(path);
        } catch (IOException e) {
            log.warn("Could not determine MIME type for file: {}", path, e);
            return "application/octet-stream";
        }
    }

    // Helper method to get primary video track (if exists)
    public TrackInfo getPrimaryVideoTrack() {
        if (trackInfos == null) return null;
        return trackInfos.stream()
                .filter(t -> "Video".equalsIgnoreCase(t.getType()))
                .findFirst()
                .orElse(null);
    }

    // Helper method to get primary audio track (if exists)
    public TrackInfo getPrimaryAudioTrack() {
        if (trackInfos == null) return null;
        return trackInfos.stream()
                .filter(t -> "Audio".equalsIgnoreCase(t.getType()))
                .findFirst()
                .orElse(null);
    }
}