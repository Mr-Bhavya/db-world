package com.db.dbworld.payloads.dbcinema.stream;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.utils.DbWorldRuntimeProperties;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.log4j.Log4j2;
import org.springframework.util.DigestUtils;
import org.springframework.util.StringUtils;

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

    /**
     * Runtime properties are used ONLY internally
     */
    @JsonIgnore
    private transient DbWorldRuntimeProperties runtime;

    /**
     * Explicit initializer (safe for Jackson + manual creation)
     */
    public MediaFileInfo initialize(DbWorldRuntimeProperties runtime) {

        this.runtime = runtime;

        if (!StringUtils.hasText(this.filePath)) {
            return this;
        }

        try {
            Path absolutePath = Paths.get(filePath).toAbsolutePath().normalize();

            // Normalize and relativize
            this.filePath = normalizePath(absolutePath);

            this.fileName = absolutePath.getFileName().toString();
            this.fileType = getFileExtension(fileName);

            BasicFileAttributes attrs =
                    Files.readAttributes(absolutePath, BasicFileAttributes.class);

            this.fileSize = attrs.size();
            this.createdDate = formatDate(attrs.creationTime().toInstant());
            this.modifiedDate = formatDate(attrs.lastModifiedTime().toInstant());

            this.id = generateStableFileId(absolutePath);
            this.mimeType = detectMimeType(absolutePath);

            return this;

        } catch (IOException e) {
            log.error("Failed to initialize MediaFileInfo for path: {}", filePath, e);
            throw new DbWorldException("Failed to initialize media file info", e);
        }
    }

    /* ---------------------------------------------------- */
    /* Internal helpers                                     */
    /* ---------------------------------------------------- */

    private String normalizePath(Path absolutePath) {
        String clean = StringUtils.cleanPath(absolutePath.toString());

        if (runtime.getStreamPath() != null) {
            clean = clean.replace(runtime.getStreamPath().toString(), "");
        }
        if (runtime.getExternalVideosPath() != null) {
            clean = clean.replace(runtime.getExternalVideosPath().toString(), "");
        }

        return clean.replace("\\", "/");
    }

    private String generateStableFileId(Path path) {
        return DigestUtils.md5DigestAsHex(
                path.toString().getBytes()
        );
    }

    private String formatDate(Instant instant) {
        return DATE_FORMATTER.format(instant);
    }

    private String getFileExtension(String filename) {
        int lastDot = filename.lastIndexOf('.');
        return lastDot > 0
                ? filename.substring(lastDot + 1).toLowerCase(Locale.ROOT)
                : "";
    }

    private String detectMimeType(Path path) {
        try {
            return Files.probeContentType(path);
        } catch (IOException e) {
            log.warn("Could not determine MIME type for {}", path);
            return "application/octet-stream";
        }
    }

    /* ---------------------------------------------------- */
    /* Convenience accessors                                */
    /* ---------------------------------------------------- */

    public TrackInfo getPrimaryVideoTrack() {
        if (trackInfos == null) return null;
        return trackInfos.stream()
                .filter(t -> "Video".equalsIgnoreCase(t.getType()))
                .findFirst()
                .orElse(null);
    }

    public TrackInfo getPrimaryAudioTrack() {
        if (trackInfos == null) return null;
        return trackInfos.stream()
                .filter(t -> "Audio".equalsIgnoreCase(t.getType()))
                .findFirst()
                .orElse(null);
    }
}
