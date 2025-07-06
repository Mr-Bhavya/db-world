package com.db.dbworld.services.Impl;

import bt.Bt;
import bt.BtException;
import bt.data.file.FileSystemStorage;
import bt.runtime.BtClient;
import bt.runtime.Config;
import bt.torrent.TorrentSessionState;
import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ExtractException;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.YtProcessStatus;
import com.db.dbworld.services.StatusService;
import com.db.dbworld.services.UtilsService;
import com.db.dbworld.stream.processor.GenericStreamProcessor;
import com.db.dbworld.stream.processor.StreamLogger;
import com.db.dbworld.stream.processor.StreamProcessor;
import com.db.dbworld.stream.processor.YtDlpStreamProcessor;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMessage;
import org.springframework.http.HttpMethod;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@Log4j2
public class UtilsServiceImpl implements UtilsService {

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private StatusService statusService;

    private static final String PROCESS_DOWNLOAD = "PROCESS_DOWNLOAD";
    private static final String PROCESS_AUDIO = "PROCESS_AUDIO";
    private static final String PROCESS_INFO = "PROCESS_INFO";
    private static final String PROCESS_FILENAME = "PROCESS_FILENAME";

    @Async
    @Override
    public void downloadHttpFile(MirrorStatus mirrorStatus) {

        this.statusService.addNewStatus(mirrorStatus);

        File file = new File(mirrorStatus.getTempFilePath());

        WebClient webClient = WebClient.builder()
                .baseUrl(mirrorStatus.getFileUrl())
                .exchangeStrategies(ExchangeStrategies.builder()
                        .codecs(clientCodecConfigurer -> clientCodecConfigurer.defaultCodecs().maxInMemorySize(100 * 1024 * 1024))
                        .build()
                )
                .clientConnector(new ReactorClientHttpConnector())
                .build();
        Flux<DataBuffer> flux = webClient.get()
                .headers(httpHeaders -> httpHeaders.set("Host", mirrorStatus.getFileUrl().split("/")[2]))
                .exchangeToFlux(response -> {
                    long contentLength = response.headers().contentLength().orElse(0);
                    this.statusService.updateMirrorStatusWithNewDownloadBytes(mirrorStatus.getId(), 0L);
                    return response.bodyToFlux(DataBuffer.class);
                })
                .takeUntil(dataBuffer -> statusService.getStatusById(mirrorStatus.getId()).isCancelled());

        try {
            FileOutputStream fileOutputStream = new FileOutputStream(file);
            OutputStream outputStream = getOutputStream(fileOutputStream, mirrorStatus);
            DataBufferUtils.write(flux, outputStream)
                    .takeUntil(dataBuffer -> statusService.getStatusById(mirrorStatus.getId()).isCancelled())
                    .doOnComplete(() -> log.info("Download Completed for file: {}", mirrorStatus.getFileName()))
                    .doOnError(throwable -> this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), throwable.getMessage()))
                    .doFinally((signalType) -> {
                        try {
                            fileOutputStream.close();
                            outputStream.close();
                        } catch (IOException e) {
                            log.error(e.getMessage());
                        }
                        postDownloadTasks(mirrorStatus.getId());
                    })
                    .subscribe(DataBufferUtils.releaseConsumer());
        } catch (Exception ex) {
            System.out.println("In Exception.");
            this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), "In Exception: " + ex.getMessage());
        }
    }

    @Async
    @Override
    public void downloadHttpFile_1(MirrorStatus mirrorStatus) {
        try {
            HttpURLConnection connection = getHttpURLConnection(mirrorStatus);

            InputStream inputStream = connection.getInputStream();
            RandomAccessFile file = new RandomAccessFile(mirrorStatus.getTempFilePath(), "rw");

            // If resuming, move to the position where the download was paused
            if (mirrorStatus.getDownloadStatus() != null && mirrorStatus.getDownloadStatus().getFileDownloaded() > 0) {
                file.seek(mirrorStatus.getDownloadStatus().getFileDownloaded());
            }

            byte[] buffer = new byte[4096];
            int bytesRead;

            while ((bytesRead = inputStream.read(buffer)) != -1) {
                mirrorStatus = statusService.getStatusById(mirrorStatus.getId());

                if (mirrorStatus.isCancelled()) {
                    statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
                    break;
                }
                if (mirrorStatus.isPause()) {
                    statusService.updateMirrorStatusWithPause(mirrorStatus.getId());
                    while (mirrorStatus.isPause() && !mirrorStatus.isCancelled()) {
                        // Wait until paused is set to false
                        Thread.sleep(1000);
                    }
                    if (mirrorStatus.isCancelled()) {
                        statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
                        break;
                    }
                }

                file.write(buffer, 0, bytesRead);

                statusService.updateMirrorStatusWithNewDownloadBytes(mirrorStatus.getId(), bytesRead);

//                statusService.updateMirrorStatusWithSpeedAndETA(mirrorStatus.getId());

                // If download completes, change state to COMPLETED
                if (statusService.getStatusById(mirrorStatus.getId()).getDownloadStatus().getFileDownloaded() >= statusService.getStatusById(mirrorStatus.getId()).getFileSize()) {
                    statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                    break;
                }
            }
            file.close();
            inputStream.close();
            connection.disconnect();
            postDownloadTasks(mirrorStatus.getId());
        } catch (IOException | InterruptedException | DbWorldException e) {
            log.error(e.getMessage());
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), e.getMessage());
        }
    }

    private static HttpURLConnection getHttpURLConnection(MirrorStatus mirrorStatus) throws IOException {
        try {
            URL url = new URL(mirrorStatus.getFileUrl());
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");

            // If the download was paused and needs to resume, use the "Range" header
            if (mirrorStatus.getDownloadStatus() != null && mirrorStatus.getDownloadStatus().getFileDownloaded() > 0) {
                connection.setRequestProperty("Range", "bytes=" + mirrorStatus.getDownloadStatus().getFileDownloaded() + "-");
            }
            return connection;
        } catch (Exception ex) {
            log.error(ex.getMessage());
            throw new DbWorldException(ex.getMessage());
        }
    }

    @Async
    @Override
    public void downloadMagnetFile(MirrorStatus mirrorStatus) {
        try {
            this.statusService.addNewStatus(mirrorStatus);
            Config config = new Config() {
                @Override
                public int getNumOfHashingThreads() {
                    return Runtime.getRuntime().availableProcessors() * 2;
                }
            };

            // create client with a private runtime
            BtClient client = Bt.client()
                    .config(config)
                    .storage(new FileSystemStorage(Path.of(DbWorldConstants.TORRENT_DOWNLOAD_HOME_PATH)))
                    .magnet(mirrorStatus.getFileUrl())
                    .autoLoadModules()
                    .stopWhenDownloaded()
                    .afterTorrentFetched(torrent -> {
                        MirrorStatus temp = this.statusService.getStatusById(mirrorStatus.getId());
                        temp.setFileSize(torrent.getSize());
                        temp.setFileName(torrent.getName());
                        this.statusService.updateStatus(temp);
                        log.info("Fetched Torrent File: {}, size: {} and files: {}", torrent.getName(), torrent.getSize(),
                                torrent.getFiles().stream().map(torrentFile -> torrentFile.getPathElements() + ":" + torrentFile.getSize()).collect(Collectors.joining()));
                    })
                    .build();
            // launch
            client.startAsync(torrentSessionStateConsumer(client, mirrorStatus), 5000).join();
        } catch (BtException ex) {
            log.error(ex.getMessage());
        }
    }

    private Consumer<TorrentSessionState> torrentSessionStateConsumer(BtClient client, MirrorStatus mirrorStatus) {
        return torrentSessionState -> {
            if (this.statusService.getStatusById(mirrorStatus.getId()).isCancelled()) {
                client.stop();
                dbWorldUtils.deleteFile(mirrorStatus.getFilePath());
                this.statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
            } else if (torrentSessionState.getPiecesRemaining() == 0) {
                client.stop();
                this.statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            } else {
                this.statusService.updateMirrorStatusWithNewDownloadBytes(
                        mirrorStatus.getId(), torrentSessionState.getLeft() <= 0 ? 0 : mirrorStatus.getFileSize() - torrentSessionState.getLeft()
                );
            }
        };
    }

    private OutputStream getOutputStream(FileOutputStream fileOutputStream, MirrorStatus mirrorStatus) {
        return new FilterOutputStream(fileOutputStream) {
            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                out.write(b, off, len);
                statusService.updateMirrorStatusWithNewDownloadBytes(mirrorStatus.getId(), len);
            }

            @Override
            public void write(int b) throws IOException {
                out.write(b);
                statusService.updateMirrorStatusWithNewDownloadBytes(mirrorStatus.getId(), b);
            }

            @Override
            public void close() throws IOException {
                fileOutputStream.close();
                super.close();
            }
        };
    }

    private void postDownloadTasks(String statusId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
        try {
            if (mirrorStatus.isCancelled()) {
                Files.delete(Path.of(mirrorStatus.getTempFilePath()));
                this.statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
            } else if (mirrorStatus.isFailed()) {
                this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), mirrorStatus.getMessage());
                Files.delete(Path.of(mirrorStatus.getTempFilePath()));
            } else {
                if (mirrorStatus.isExtract()) {
                    this.statusService.updateMirrorStatusWithExtracting(mirrorStatus.getId());
                    try {
                        this.extract(mirrorStatus.getId(), mirrorStatus.getTempFilePath(), mirrorStatus.getTempExtractedFilePath(), null);
                        this.statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                        log.info("Extract Completed for file: {}", mirrorStatus.getFileName());
                        log.info("Moving folder \"{}\" ===> \"{}\".", mirrorStatus.getTempExtractedFilePath(), mirrorStatus.getExtractedFileName());
                        FileUtils.moveDirectory(new File(mirrorStatus.getTempExtractedFilePath()), new File(mirrorStatus.getExtractedFilePath()));
                        Files.delete(Path.of(mirrorStatus.getTempFilePath()));
                    } catch (ExtractException ex) {
                        FileUtils.moveFile(new File(mirrorStatus.getTempFilePath()), new File(mirrorStatus.getFilePath()));
                        StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
                        throw new DbWorldException(ex.getMessage());
                    }
                } else {
                    FileUtils.moveFile(new File(mirrorStatus.getTempFilePath()), new File(mirrorStatus.getFilePath()));
                    this.statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
                }
            }
        } catch (IOException | DbWorldException ex) {
            this.statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), ex.getMessage());
            log.error(ex);
        }
    }

    @Override
    public void extract(String mirrorId, String sourcePath, String targetPath, String password) throws IOException {
        ProcessBuilder pb = new ProcessBuilder("7z", "x", sourcePath, "-o" + targetPath, "-aou");
        pb.redirectErrorStream(true);
        Process process = pb.start();

        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        StreamProcessor streamProcessor = new GenericStreamProcessor(statusService, mirrorStatus);

        Thread streamThread = new Thread(() -> streamProcessor.handle(process.getInputStream(), false));
        streamThread.start();

        try {
            int exitCode = process.waitFor();
            streamThread.join(); // Ensure log thread finishes reading
            if (exitCode != 0) {
                throw new ExtractException("Extraction failed. Exit code: " + exitCode);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ExtractException("Extraction interrupted: " + e.getMessage());
        }
    }

    @Override
    public JsonObject getInfoYtFile(String url) {
        List<String> command = getYtCommand(url, PROCESS_INFO, null);
        Process process = null;

        try {
            process = new ProcessBuilder(command).start();

            String output = readStream(process.getInputStream());
            String errorOutput = readStream(process.getErrorStream());

            int exitCode = process.waitFor();

            if (exitCode != 0) {
                throw new DbWorldException("yt-dlp exited with code " + exitCode + ": " + errorOutput);
            }

            if (isNullOrBlankJson(output)) {
                throw new DbWorldException("yt-dlp returned empty output for URL: " + url);
            }

            JsonObject result = new Gson().fromJson(output.replace("null\n", ""), JsonObject.class);
            if (result == null || result.isJsonNull() || result.entrySet().isEmpty()) {
                throw new DbWorldException("Failed to parse yt-dlp output JSON for URL: " + url);
            }

            log.info("yt-dlp info fetched successfully for url {}", url);
            return result;

        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new DbWorldException("Failed to execute yt-dlp command: " + e.getMessage(), e);
        } finally {
            if (process != null) {
                process.destroyForcibly();
            }
        }
    }

    private String readStream(InputStream stream) throws IOException {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }

    private boolean isNullOrBlankJson(String input) {
        return input == null || input.isBlank() || "null".equalsIgnoreCase(input.trim()) || "{}".equals(input.trim());
    }

    @Override
    public void deleteTempFiles() {
        File[] listFiles = new File(DbWorldConstants.TEMP_DOWNLOAD_PATH).listFiles();
        if (listFiles != null && listFiles.length != 0) {
            Arrays.stream(listFiles).forEach(file -> {
                dbWorldUtils.deleteFile(file.getAbsolutePath());
            });
        }
    }

    @Async
    @Override
    public void downloadYtFile(MirrorStatus mirrorStatus) {
        statusService.addNewStatus(mirrorStatus);

        try {
            ProcessBuilder processBuilder = new ProcessBuilder(getYtCommand(
                    mirrorStatus.getFileUrl(), PROCESS_DOWNLOAD, mirrorStatus.getId()
            ));
            Process process = processBuilder.start();

            StreamProcessor stdout = new YtDlpStreamProcessor(statusService, mirrorStatus, () -> {
                try {
                    updateFileNames(mirrorStatus);
                } catch (IOException | InterruptedException e) {
                    StreamLogger.appendHtmlLine(mirrorStatus, e.getMessage(), true, statusService);
                    throw new DbWorldException(e.getMessage());
                }
            });
            StreamProcessor stderr = new YtDlpStreamProcessor(statusService, mirrorStatus, () -> {});

            new Thread(() -> stdout.handle(process.getInputStream(), false)).start();
            new Thread(() -> stderr.handle(process.getErrorStream(), true)).start();

            boolean finished = process.waitFor(30, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                throw new DbWorldException("yt-dlp timed out.");
            }

            if (process.exitValue() == 0 || process.exitValue() == 1) {
                moveDownloadedFile(mirrorStatus);
                statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            }

        } catch (Exception ex) {
            StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
        }
    }

    private void updateFileNames(MirrorStatus mirrorStatus) throws IOException, InterruptedException {
        String filename = getYtOutputFileName(mirrorStatus);
        String ext = filename.substring(filename.lastIndexOf("."));

        mirrorStatus.setFileName(mirrorStatus.getFileName() + ext);
        mirrorStatus.setTempFileName(mirrorStatus.getTempFileName() + ext);
        mirrorStatus.setFilePath(mirrorStatus.getFilePath() + ext);
        mirrorStatus.setTempFilePath(mirrorStatus.getTempFilePath() + ext);
        statusService.updateStatus(mirrorStatus);
    }

    private String getBestAudioFormat(String audioITag) {
        return (audioITag == null || audioITag.isEmpty() || "0".equals(audioITag)) ? "bestaudio" : audioITag;
    }

    private String getBestVideoAudioFormat(String videoITag, String audioITag) {
        return Optional.ofNullable(videoITag).orElse("bestvideo") + "+" + getBestAudioFormat(audioITag) + "/best";
    }

    private void moveDownloadedFile(MirrorStatus mirrorStatus) throws IOException {
        FileUtils.moveFile(
                new File(mirrorStatus.getTempFilePath()),
                new File(mirrorStatus.getFilePath()),
                StandardCopyOption.REPLACE_EXISTING
        );
    }

    private String getYtOutputFileName(MirrorStatus mirrorStatus) throws IOException, InterruptedException {
        List<String> command = getYtCommand(mirrorStatus.getFileUrl(), PROCESS_FILENAME, mirrorStatus.getId());
        Process process = new ProcessBuilder(command).start();
        String fileName = new String(process.getInputStream().readAllBytes()).trim();
        process.waitFor();

        if (process.exitValue() == 2) {
            throw new DbWorldException(new String(process.getErrorStream().readAllBytes()));
        }
        log.info("Filename fetched successfully: {}", fileName);
        return fileName;
    }

    private List<String> getYtCommand(String url, String processType, String statusId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId == null ? "0" : statusId);
        List<String> cmd = new ArrayList<>(List.of(
                DbWorldConstants.YT_DLP,
                "--progress-template", "%(progress)j"
        ));

        if (url.contains(DbWorldConstants.HOTSTAR_COM)) {
            cmd.addAll(List.of(DbWorldConstants.YTDLP_COOKIES_CMD, DbWorldConstants.HS_COOKIES_PATH));
        }

        switch (processType) {
            case PROCESS_INFO:
                cmd.addAll(List.of(url, "-J"));
                break;

            case PROCESS_DOWNLOAD:
                cmd.addAll(List.of(
                        "-f", getBestVideoAudioFormat(mirrorStatus.getVideoITag(), mirrorStatus.getAudioITag()),
                        "-o", mirrorStatus.getTempFilePath() + ".%(ext)s",
                        url
                ));
                break;

            case PROCESS_FILENAME:
                cmd.addAll(List.of(
                        "-f", getBestVideoAudioFormat(mirrorStatus.getVideoITag(), mirrorStatus.getAudioITag()),
                        "--print", "filename",
                        url
                ));
                break;
        }

        log.info("Running [{}] command: {}", processType, String.join(" ", cmd));
        return cmd;
    }

//    @Override
//    public HttpHeaders getHeaders(String httpUrl) {
//        try {
//            URI uri = new URI(httpUrl);
//            String host = uri.getHost();
//
//            RestTemplate restTemplate = new RestTemplate();
//            return restTemplate.execute(
//                    httpUrl,
//                    HttpMethod.HEAD,
//                    request -> request.getHeaders().set("Host", host),
//                    response -> {
//                        HttpHeaders headers = response.getHeaders();
//                        log.info("Status code: {}", response.getStatusCode());
//                        log.info("Content-Length: {}", headers.getContentLength());
//                        log.info("Content-Disposition: {}", headers.getFirst("Content-Disposition"));
//                        return headers;
//                    }
//            );
//        } catch (URISyntaxException ex) {
//            log.error("Invalid URI syntax: {}", httpUrl, ex);
//            throw new DbWorldException("Invalid URL: " + httpUrl, ex);
//        } catch (WebClientResponseException ex) {
//            log.error("WebClientResponseException: {}", ex.getMessage(), ex);
//            return ex.getHeaders(); // can still return headers if available
//        } catch (ResourceAccessException ex) {
//            log.error("Connection failed for URL: {}", httpUrl, ex);
//            return null;
//        } catch (Exception ex) {
//            log.error("Unexpected error while getting headers: {}", ex.getMessage(), ex);
//            throw new DbWorldException("Error fetching headers from: " + httpUrl, ex);
//        }
//    }
//


}
