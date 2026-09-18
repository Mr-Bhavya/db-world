package com.db.dbworld.utils;

import com.db.dbworld.config.AppProperties;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.helpers.DbWorldRecords;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.ContentDisposition;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.FileSystemUtils;

import java.io.*;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.*;

@Service
@Log4j2
public class DbWorldUtils {

    private final AppProperties runtimeProperties;

    public DbWorldUtils (AppProperties runtimeProperties) {
        this.runtimeProperties = runtimeProperties;
    }

    public byte[] serialize(Object obj) throws IOException {
        try (
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                ObjectOutputStream os = new ObjectOutputStream(out)
        ) {
            os.writeObject(obj);
            return out.toByteArray();
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }

    }

    public Object deserialize(byte[] data) {
        try (
                ByteArrayInputStream in = new ByteArrayInputStream(data);
                ObjectInputStream is = new ObjectInputStream(in);
        ) {
            return is.readObject();
        } catch (IOException | ClassNotFoundException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    public List<String> readFileInList(String filePath) {
        try {
            return Files.readAllLines(Paths.get(filePath), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new DbWorldException(e.getMessage());
        }
    }

    /**
     * Decodes a URL-encoded file name string while handling special character cases.
     *
     * @param encodedString The URL-encoded string to decode (cannot be null)
     * @return The decoded file name string
     * @throws DbWorldException if the input string is null or if decoding fails
     * @throws IllegalArgumentException if the input string is null
     */
    public String decodeFileName(String encodedString) {
        // Validate input parameter
        if (encodedString == null) {
            throw new IllegalArgumentException("Encoded string cannot be null");
        }

        try {
            // First decode the string (temporarily converting + to %2B to preserve literal +)
            String decodedString = URLDecoder.decode(
                    encodedString.replace("+", "%2B"),
                    StandardCharsets.UTF_8
            );

            // Restore actual + characters and remove problematic characters
            return cleanFileName(
                    decodedString.replace("%2B", "+")
            );
        } catch (Exception e) {
            throw new DbWorldException("Failed to decode file name: " + encodedString, e);
        }
    }

    /**
     * Cleans a file name by removing invalid characters.
     *
     * @param fileName The file name to clean
     * @return The cleaned file name with invalid characters removed
     */
    private String cleanFileName(String fileName) {
        return fileName.replace("/", "").replace("|", "");
    }

    public DbWorldRecords.FileSizeInfo getFileSizeInfo(Path path) {
        try {
            long size = Files.size(path);
            if (size <= 0) {
                throw new DbWorldException("Invalid file size: " + size);
            }
            return new DbWorldRecords.FileSizeInfo(size);
        } catch (IOException e) {
            throw new DbWorldException("Failed to determine file size for " + path, e);
        }
    }

    /**
     * Moves a file or directory from source to destination path, with options to handle existing files and error behavior.
     *
     * @param src The source path of the file/directory to move (cannot be null or empty)
     * @param des The destination path where to move the file/directory (cannot be null or empty)
     * @param throwOnError If true, throws exceptions on errors; if false, logs errors and continues
     * @throws DbWorldException if throwOnError is true and an error occurs during the operation
     * @throws IllegalArgumentException if src or des parameters are null or empty
     */
    public void moveFileOrDir(String src, String des, boolean throwOnError) {
        // Validate input parameters
        if (src == null || src.trim().isEmpty()) {
            throw new IllegalArgumentException("Source path cannot be null or empty");
        }
        if (des == null || des.trim().isEmpty()) {
            throw new IllegalArgumentException("Destination path cannot be null or empty");
        }

        Path sourcePath = Paths.get(src);
        Path destPath = Paths.get(des);

        try {
            // Check if source exists
            if (!Files.exists(sourcePath)) {
                String msg = "Source path does not exist: " + sourcePath;
                if (throwOnError) {
                    throw new IOException(msg);
                }
                log.warn(msg);
                return;
            }

            // Ensure destination parent directory exists
            if (destPath.getParent() != null) {
                Files.createDirectories(destPath.getParent());
            }

            // Handle existing destination
            if (Files.exists(destPath)) {
                // Delete destination recursively if it exists
                Files.walkFileTree(destPath, new SimpleFileVisitor<>() {
                    @Override
                    public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                        Files.delete(file);
                        return FileVisitResult.CONTINUE;
                    }

                    @Override
                    public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                        Files.delete(dir);
                        return FileVisitResult.CONTINUE;
                    }
                });
            }

            // Perform the move operation with overwrite
            Files.move(sourcePath, destPath, StandardCopyOption.REPLACE_EXISTING);

            log.info("Moved successfully from {} to {}", sourcePath, destPath);

        } catch (IOException e) {
            if (throwOnError) {
                throw new DbWorldException("Failed to move file or directory from " + src + " to " + des, e);
            } else {
                log.error("Failed to move file or directory from {} to {}", src, des, e);
            }
        }
    }

    public MediaType determineContentType(Path path) {
        try {
            String mimeType = Files.probeContentType(path);
            return MediaType.parseMediaType(mimeType != null ? mimeType : "application/octet-stream");
        } catch (IOException e) {
            log.warn("Could not determine content type for {}, defaulting to octet-stream", path);
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    public ContentDisposition createContentDisposition(Path path, boolean inline) {
        String filename = path.getFileName().toString();
        return inline ?
                ContentDisposition.inline().filename(filename).build() :
                ContentDisposition.attachment().filename(filename).build();
    }

    /**
     * Deletes a file or directory at the specified path with configurable error handling
     *
     * @param path The path of the file/directory to delete (cannot be null or empty)
     * @param throwOnError If true, throws exceptions on failures; if false, logs errors
     * @throws DbWorldException if throwOnError is true and deletion fails
     * @throws IllegalArgumentException if path is null or empty
     */
    public void deleteFileOrDirectory(String path, boolean throwOnError) throws DbWorldException {
        // Validate input
        if (path == null || path.trim().isEmpty()) {
            String errorMessage = "Path cannot be null or empty";
            if (throwOnError) {
                throw new IllegalArgumentException(errorMessage);
            }
            log.error(errorMessage);
            return;
        }

        try {
            Path filePath = Path.of(path);

            // Check if path exists
            if (!Files.exists(filePath)) {
                String warningMessage = "Path does not exist: " + path;
                if (throwOnError) {
                    throw new IOException(warningMessage);
                }
                log.warn(warningMessage);
                return;
            }

            // Delete the file/directory
            if (Files.isDirectory(filePath)) {
                FileSystemUtils.deleteRecursively(filePath);
                log.info("Successfully deleted directory: {}", path);
            } else {
                Files.delete(filePath);
                log.info("Successfully deleted file: {}", path);
            }

        } catch (IOException e) {
            String errorMessage = String.format("Failed to delete %s: %s",
                    Files.isDirectory(Path.of(path)) ? "directory" : "file",
                    e.getMessage());

            if (throwOnError) {
                throw new DbWorldException(errorMessage, e);
            }
            log.error(errorMessage);
        }
    }

    public String getClientIpAddress(HttpServletRequest request) {
        try {
            String xForwardedFor = request.getHeader("X-Forwarded-For");
            if (xForwardedFor != null && !xForwardedFor.isEmpty() && !"unknown".equalsIgnoreCase(xForwardedFor)) {
                String[] ips = xForwardedFor.split(",");
                for (String ip : ips) {
                    String cleanedIp = ip.trim();
                    if (!cleanedIp.isEmpty() && !"unknown".equalsIgnoreCase(cleanedIp)) {
                        return cleanedIp;
                    }
                }
            }

            String[] headers = {
                    "X-Real-IP", "Proxy-Client-IP", "WL-Proxy-Client-IP",
                    "HTTP_CLIENT_IP", "HTTP_X_FORWARDED_FOR"
            };

            for (String header : headers) {
                String ip = request.getHeader(header);
                if (ip != null && !ip.isEmpty() && !"unknown".equalsIgnoreCase(ip)) {
                    return ip;
                }
            }

            return request.getRemoteAddr();
        } catch (Exception e) {
            log.warn("Error extracting client IP address", e);
            return request.getRemoteAddr();
        }
    }

    public ZonedDateTime getISTDateTime(){
        return ZonedDateTime.ofInstant(Instant.now(), ZoneId.of("Asia/Kolkata"));
    }

}
