package com.db.dbworld.services.Impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.services.DownloadStatus;
import com.db.dbworld.services.StreamService;
import com.db.dbworld.services.UserService;
import com.db.dbworld.utils.DbWorldConstants;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

import static org.springframework.util.StreamUtils.BUFFER_SIZE;

@Service
@Log4j2
@CacheConfig(cacheNames = "DB-Stream")
public class StreamServiceImpl implements StreamService {

    @Autowired
    private ResourceLoader resourceLoader;

    @Autowired
    private UserService userService;

    @Async
    @Override
    public CompletableFuture<ResponseEntity<InputStreamResource>> getStreamResource(Path path, String range) {

        final Long fileSize = getFileSize(path);
        long rangeStart = 0;
        long rangeEnd = Math.min(DbWorldConstants.CHUNK_SIZE, fileSize - 1);

        if (range == null) {
            return CompletableFuture.completedFuture(ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                    .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                    .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                    .header(DbWorldConstants.CONTENT_LENGTH_HEADER, String.valueOf(rangeEnd))
                    .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                    .body(readResource(path, rangeStart))); // Read the object and convert it as bytes
        }
        String[] ranges = range.split("-");
        rangeStart = Long.parseLong(ranges[0].substring(6));
        if (ranges.length > 1) {
            rangeEnd = Long.parseLong(ranges[1]);
        } else {
            rangeEnd = rangeStart + DbWorldConstants.CHUNK_SIZE;
        }

        rangeEnd = Math.min(rangeEnd, fileSize - 1);
        final String contentLength = String.valueOf((rangeEnd - rangeStart) + 1);
        HttpStatus httpStatus = HttpStatus.PARTIAL_CONTENT;
        if (rangeEnd >= fileSize) {
            httpStatus = HttpStatus.OK;
        }
        return CompletableFuture.completedFuture(ResponseEntity.status(httpStatus)
                .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                .header(DbWorldConstants.CONTENT_LENGTH_HEADER, contentLength)
                .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                .body(readResource(path, rangeStart)));
    }

    // Service class
    @Override
    public ResponseEntity<Void> downloadFileFromCDN(String user, Path path, String rangeHeader, boolean inline) {
        String downloadId = user + "-" + path.getFileName();
        long fileSize;
        long rangeStart = 0;
        boolean isPartial = false;

        try {
            fileSize = Files.size(path);
        } catch (IOException e) {
            throw new DbWorldException("Failed to determine file size.", e);
        }

        try {
            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                try {
                    rangeStart = Long.parseLong(rangeHeader.substring(6).split("-")[0].trim());
                    if (rangeStart > 0) {
                        isPartial = true;
                    }
                } catch (NumberFormatException e) {
                    throw new DbWorldException("Invalid Range Header format.", e);
                }
            }

            HttpHeaders headers = new HttpHeaders();

            // Important for range request
            if (isPartial) {
                headers.set(HttpHeaders.CONTENT_RANGE, "bytes " + rangeStart + "-" + (fileSize - 1) + "/" + fileSize);
                headers.setContentLength(fileSize - rangeStart);
            } else {
                headers.setContentLength(fileSize);
            }

            String accelRedirectUrl = String.format("/cdn/stream/%s?userId=%s&downloadId=%s&originalFile=%s&rangeStart=%d&requestId=%s&type=%s",
                    path,
                    URLEncoder.encode(user, StandardCharsets.UTF_8),
                    URLEncoder.encode(downloadId, StandardCharsets.UTF_8),
                    URLEncoder.encode(path.toString(), StandardCharsets.UTF_8),
                    rangeStart,
                    UUID.randomUUID(),
                    inline ? DownloadStatus.DownloadType.STREAM.toString() : DownloadStatus.DownloadType.DOWNLOAD.toString()
            );  
            headers.add("X-Accel-Redirect", accelRedirectUrl);

            // MIME Type
            String mimeType;
            try {
                mimeType = Files.probeContentType(path);
            } catch (IOException e) {
                mimeType = null;
            }
            headers.setContentType(MediaType.parseMediaType(mimeType != null ? mimeType : "application/octet-stream"));

            // Content-Disposition (attachment = download, inline = stream/play)
            ContentDisposition disposition = inline ?
                    ContentDisposition.inline().filename(path.getFileName().toString()).build()
                    : ContentDisposition.attachment().filename(path.getFileName().toString()).build();
            headers.setContentDisposition(disposition);

            // Return 206 for partial, otherwise 200
            return new ResponseEntity<>(headers, isPartial ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK);

        } catch (Exception e) {
            log.error("Error during file stream/download: {}", e.getMessage());
            throw new DbWorldException("Error during streaming/download", e);
        }
    }



    /**
     * Checks if an IOException is due to a client disconnect.
     */
    private boolean isClientDisconnect(IOException e) {
        String msg = e.getMessage();
        return msg != null && (msg.contains("Broken pipe") ||
                msg.contains("Connection reset") ||
                msg.contains("Idle timeout"));
//                || msg.contains("ServletOutputStream failed to write: null"));
    }


    @Override
    @Async
    public CompletableFuture<ResponseEntity<InputStreamResource>> getDownloadResource(Path path, String range) {
        final Long fileSize = getFileSize(path);
        long rangeStart = 0;
        long rangeEnd = (fileSize - 1);
        HttpStatusCode httpStatusCode = HttpStatus.OK;
        if (range != null) {
            String[] ranges = range.split("-");
            rangeStart = Long.parseLong(ranges[0].substring(6));
            httpStatusCode = HttpStatus.PARTIAL_CONTENT;
        }
        return CompletableFuture.completedFuture(ResponseEntity.status(httpStatusCode)
//                    .header(HttpHeaders.TRANSFER_ENCODING, "chunked")
                .header(DbWorldConstants.ACCEPT_RANGES_HEADER, DbWorldConstants.BYTES)
                .header(DbWorldConstants.CONTENT_TYPE_HEADER, MediaType.APPLICATION_OCTET_STREAM_VALUE)
                .header(DbWorldConstants.CONTENT_LENGTH_HEADER, String.valueOf(fileSize))
                .header(DbWorldConstants.CONTENT_DISPOSITION_HEADER, getContentDisposition(path))
                .header(DbWorldConstants.CONTENT_RANGE_HEADER, DbWorldConstants.BYTES + " " + rangeStart + "-" + rangeEnd + "/" + fileSize)
                .body(readResource(path, rangeStart)));
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public List<HashMap<String, Object>> getList(String path) {
        Path normalPath = Path.of(DbWorldConstants.STREAM_HOME_PATH + File.separator + path);
        Path externalDiskPath = Path.of(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH + File.separator + path);
        List<Path> list = new ArrayList<>();
        try {
            if (path == null || path.isEmpty()) {
                list.addAll(Files.list(normalPath).toList());
                if (Files.exists(externalDiskPath))
                    list.addAll(Files.list(externalDiskPath).toList());
                else
                    log.warn("External Disk Stream Path is ignored.");
            } else {
                if (Files.exists(normalPath)) {
                    list.addAll(Files.list(normalPath).toList());
                } else if (Files.exists(externalDiskPath)) {
                    list.addAll(Files.list(externalDiskPath).toList());
                } else {
                    list.addAll(Files.list(Path.of(DbWorldConstants.STREAM_HOME_PATH)).toList());
                }
            }
            return list.stream().map(this::createDetails).collect(Collectors.toList());
        } catch (IOException e) {
            throw new DbWorldException(e.toString());
        }
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public ArrayList<File> getListRecursive(Path dir) {
        ArrayList<File> files = new ArrayList<>();
        if (Files.exists(dir) && Files.isDirectory(dir)) {
            Arrays.stream(Objects.requireNonNull(dir.toFile().listFiles())).forEach(file -> {
                if (file.isDirectory()) {
                    files.addAll(getListRecursive(file.toPath()));
                } else {
                    files.add(file);
                }
            });
        }
        return files;
    }

    @Override
//    @Cacheable(keyGenerator = DbWorldConstants.CUSTOM_REDIS_KEY_GENERATOR)
    public HashMap<String, Object> createDetails(Path path) {
        HashMap<String, Object> hashMap = new LinkedHashMap<>();
        try {
            hashMap.put("fileName", path.toFile().getName());
            hashMap.put("filePath", path.toFile().getPath().replace("\\", "/")
                    .replace(DbWorldConstants.STREAM_HOME_PATH, "")
                    .replace(DbWorldConstants.EXTERNAL_STREAM_HOME_PATH, ""));
            hashMap.put("isDirectory", path.toFile().isDirectory());
            hashMap.put("isFile", path.toFile().isFile());
            hashMap.put("fileSize", Files.size(path));
            hashMap.put("isFTP", false);
            hashMap.put("fileId", Files.size(path));
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
        return hashMap;
    }

    private StreamingResponseBody readStreamingBody(Path path, long start, long end) {

        return outputStream -> {
            try (InputStream inputStream = Files.newInputStream(path, StandardOpenOption.READ)) {
                byte[] buffer = new byte[64 * 1024]; // 64 KB buffer
                long bytesToRead = end - start + 1;
                long bytesRead = 0;

                // Skip to the start position
                inputStream.skip(start);

                while (bytesRead < bytesToRead) {
                    int bytesToWrite = (int) Math.min(buffer.length, bytesToRead - bytesRead);
                    int read = inputStream.read(buffer, 0, bytesToWrite);
                    if (read == -1) {
                        break; // End of file
                    }
                    outputStream.write(buffer, 0, read);
                    bytesRead += read;
                }
                outputStream.flush();
            } catch (IOException e) {
                throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, "Error streaming file: " + e.getMessage());
            }
        };

//        int bufferSize = 1024 * 1024; // 1 MB buffer size
//        return os -> {
//            try (RandomAccessFile file = new RandomAccessFile(path.toString(), "r")) {
//                byte[] buffer = new byte[bufferSize];
//                long pos = start;
//                file.seek(pos);
//                while (pos < end) {
//                    int bytesToRead = (int) Math.min(bufferSize, end - pos + 1);
//                    int bytesRead = file.read(buffer, 0, bytesToRead);
//                    if (bytesRead == -1) {
//                        break; // End of file
//                    }
//                    os.write(buffer, 0, bytesRead);
//                    pos += bytesRead;
//                }
//                os.flush();
//            } catch (Exception e) {
//                throw new DbWorldException(e.getMessage());
//            }
//        };
    }

    private InputStreamResource readResource(Path path, long start) {
        InputStream inputStream = null;
        try {
            inputStream = Files.newInputStream(path);
            inputStream.skip(start);
        } catch (IOException e) {
            throw new DbWorldException(HttpStatus.INTERNAL_SERVER_ERROR, e.getMessage());
        }
        return new InputStreamResource(inputStream);
    }

    public String getContentDisposition(Path path) {
        return ContentDisposition.builder("attachment")
                .filename(path.getFileName().toString(), StandardCharsets.UTF_8)
                .build().toString();
    }

    public Long getFileSize(Path path) {
        try {
            return Files.size(path);
        } catch (IOException ioException) {
            log.error("Error while getting the file size. filepath: {}, Error: {}", path.toString(), ioException.getMessage());
            throw new DbWorldException("Error while getting the file size. filepath: " + path + " Error: " + ioException.getMessage());
        }
    }

}
