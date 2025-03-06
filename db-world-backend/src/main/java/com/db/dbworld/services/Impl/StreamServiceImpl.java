package com.db.dbworld.services.Impl;

import com.db.dbworld.exceptions.DbWorldException;
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

    @Autowired
    private DownloadTrackerServiceImpl downloadTrackerService;

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

    @Override
    public ResponseEntity<StreamingResponseBody> downloadFile(String user, Path path, String rangeHeader) {
        String downloadId = user + "-" + path.getFileName();
        try {
            final long fileSize = Files.size(path);
            long rangeStart;
            long rangeEnd;
            if (rangeHeader != null && rangeHeader.startsWith("bytes=")) {
                String[] ranges = rangeHeader.substring(6).split("-");
                rangeStart = Long.parseLong(ranges[0].trim());
                rangeEnd = (ranges.length > 1 && !ranges[1].isEmpty()) ? Long.parseLong(ranges[1].trim()) : fileSize - 1;
            } else {
                rangeStart = 0;
                rangeEnd = fileSize - 1;
            }

            // Initialize or resume the download session (no DB insert here).
            downloadTrackerService.startOrResumeDownload(downloadId, path.getFileName().toString(), user, fileSize, rangeStart);

            StreamingResponseBody responseBody = outputStream -> {
                long totalBytesRead = 0;
                long updateThreshold = 1024 * 1024; // 1MB
                long lastUpdateBytes = 0;

                try (InputStream inputStream = Files.newInputStream(path)) {
                    if (rangeStart > 0) {
                        long skipped = inputStream.skip(rangeStart);
                        if (skipped < rangeStart) {
                            throw new IOException("Unable to skip to the requested range start.");
                        }
                    }

                    byte[] buffer = new byte[BUFFER_SIZE];
                    long bytesToRead = rangeEnd - rangeStart + 1;
                    while (totalBytesRead < bytesToRead) {
                        int bytesRemaining = (int) Math.min(buffer.length, bytesToRead - totalBytesRead);
                        int bytesRead = inputStream.read(buffer, 0, bytesRemaining);
                        if (bytesRead == -1) {
                            break;
                        }
                        try {
                            outputStream.write(buffer, 0, bytesRead);
                        } catch (IOException e) {
                            if (isClientDisconnect(e)) {
                                downloadTrackerService.updateDownloadedRange(downloadId, rangeStart, rangeStart + totalBytesRead - 1);
                                downloadTrackerService.pauseDownload(downloadId);
                                break;
                            } else if (e.getMessage().contains("ServletOutputStream failed to flush: null")) {
                                downloadTrackerService.updateDownloadedRange(downloadId, rangeStart, rangeStart + totalBytesRead - 1);
                                break;
                            } else {
                                throw e;
                            }
                        }
                        totalBytesRead += bytesRead;
                        if (totalBytesRead - lastUpdateBytes >= updateThreshold) {
                            downloadTrackerService.updateDownloadedRange(downloadId, rangeStart, rangeStart + totalBytesRead - 1);
                            lastUpdateBytes = totalBytesRead;
                        }
                    }
                    // Final update after streaming completes.
                    if (totalBytesRead > 0) {
                        downloadTrackerService.updateDownloadedRange(downloadId, rangeStart, rangeStart + totalBytesRead - 1);
                    }
                    // If the full requested range was delivered, mark the download as complete.
                    if (totalBytesRead == (rangeEnd - rangeStart + 1)) {
                        downloadTrackerService.completeDownload(downloadId);
                    }
                } catch (IOException e) {
                    if (!isClientDisconnect(e)) {
                        downloadTrackerService.failDownload(downloadId, e.getMessage());
                    }
                    throw e;
                }
            };

            HttpHeaders headers = new HttpHeaders();
            headers.add("Content-Type", Files.probeContentType(path));
            headers.add("Content-Disposition", "attachment; filename=\"" + path.getFileName().toString() + "\"");
            headers.add("Accept-Ranges", "bytes");

            if (rangeHeader != null) {
                headers.add("Content-Range", "bytes " + rangeStart + "-" + rangeEnd + "/" + fileSize);
                headers.add("Content-Length", String.valueOf(rangeEnd - rangeStart + 1));
                return new ResponseEntity<>(responseBody, headers, HttpStatus.PARTIAL_CONTENT);
            } else {
                headers.add("Content-Length", String.valueOf(fileSize));
                return new ResponseEntity<>(responseBody, headers, HttpStatus.OK);
            }
        } catch (NoSuchFileException | FileNotFoundException e) {
            log.error("File not found: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found", e);
        } catch (IOException e) {
            log.error("I/O error during download: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "I/O error", e);
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
            inputStream.skip(start);
            inputStream = Files.newInputStream(path);
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
