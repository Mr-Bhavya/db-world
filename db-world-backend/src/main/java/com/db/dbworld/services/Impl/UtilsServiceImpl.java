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
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonSyntaxException;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
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
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.function.Consumer;
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
                    this.statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), 0L);
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

                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), bytesRead);

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
                this.statusService.updateMirrorStatusWithDownloadState(
                        mirrorStatus.getId(),torrentSessionState.getLeft() <= 0 ? 0 : mirrorStatus.getFileSize() - torrentSessionState.getLeft()
                );
            }
        };
    }

    private OutputStream getOutputStream(FileOutputStream fileOutputStream, MirrorStatus mirrorStatus) {
        return new FilterOutputStream(fileOutputStream) {
            @Override
            public void write(byte[] b, int off, int len) throws IOException {
                out.write(b, off, len);
                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), len);
            }

            @Override
            public void write(int b) throws IOException {
                out.write(b);
                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), b);
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

        // Start a thread to read and display the output
        new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    // Print each line of output from the process
                    if (mirrorId != null) {
                        String message = statusService.getStatusById(mirrorId).getMessage() == null ? "" : statusService.getStatusById(mirrorId).getMessage();
                        statusService.updateStatusMessage(mirrorId, message + "\n" + line);
                    }
                }
            } catch (IOException e) {
                log.error(e.getMessage());
            }
        }).start();

        // Wait for the process to finish
        try {
            int exitCode = process.waitFor();
            System.out.println("Process exited with code: " + exitCode);
            if (exitCode != 0) {
                throw new ExtractException("Extraction failed.");
            }
        } catch (InterruptedException e) {
            throw new ExtractException(e.getMessage());
        }

    }

    @Override
    public JsonObject getInfoYtFile(String url) {
        JsonObject jsonInfoObj = new JsonObject();
        Process process;
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(getYtCommand(url, PROCESS_INFO, null));
            process = processBuilder.start();

            InputStream inputStream = process.getInputStream();
            String inputString = new String(inputStream.readAllBytes());
            if (inputString == null || inputString.isEmpty() || inputString.isBlank() || inputString.equals("null") || inputString.equals("null\n")) {
                String errorString = new String(process.getErrorStream().readAllBytes());
                if (!errorString.isBlank()) {
                    throw new DbWorldException(errorString);
                }
            } else {
                jsonInfoObj = new Gson().fromJson(inputString.replace("null\n", ""), JsonObject.class);
            }
            process.waitFor();
            if (jsonInfoObj == null || jsonInfoObj.isEmpty() || jsonInfoObj.isJsonNull()) {
                throw new DbWorldException("Not able to fetch details from given url: " + url);
            }
        } catch (IOException | InterruptedException e) {
            throw new DbWorldException(e.getMessage());
        }
        log.info("Process is completed and info fetched with exit code: {}", process.exitValue());
        return jsonInfoObj;
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
            ProcessBuilder processBuilder = new ProcessBuilder(
                    getYtCommand(mirrorStatus.getFileUrl(), PROCESS_DOWNLOAD, mirrorStatus.getId()));
            Process process = processBuilder.start();
            process.waitFor();

            new Thread(() -> handleProcessOutput(process, mirrorStatus)).start();
        } catch (IOException | InterruptedException ex) {
            handleDownloadError(mirrorStatus, ex);
        }
    }

    private void handleProcessOutput(Process process, MirrorStatus mirrorStatus) {
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            boolean isFileNameFetched = false;

            while ((line = reader.readLine()) != null) {
                if (statusService.getStatusById(mirrorStatus.getId()).isCancelled()) {
                    terminateProcess(process, mirrorStatus);
                    return;
                }

                if (line.contains("downloaded_bytes") && line.contains("status")) {
                    updateDownloadStatus(line, mirrorStatus);

                    if (!isFileNameFetched && line.contains("\"status\": \"finished\"")) {
                        updateFileNames(mirrorStatus);
                        isFileNameFetched = true;
                    }
                }
            }

            if (process.exitValue() == 0 || process.exitValue() == 1) {
                moveDownloadedFile(mirrorStatus);
                statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
            }
        } catch (IOException | InterruptedException e) {
            handleDownloadError(mirrorStatus, e);
        }
    }

    private void terminateProcess(Process process, MirrorStatus mirrorStatus) throws IOException {
        process.destroy();
        Runtime.getRuntime().exec(new String[]{"kill", "-9", String.valueOf(process.pid())});
        statusService.updateMirrorStatusWithCancelled(mirrorStatus.getId());
    }

    private void updateDownloadStatus(String jsonLine, MirrorStatus mirrorStatus) {
        try {
            jsonLine = (jsonLine.startsWith("\"") && jsonLine.endsWith("\"") ? jsonLine.substring(1, jsonLine.length() - 1) : jsonLine)
                    .replace(" ", "");
            YtProcessStatus ytProcessStatus = new Gson().fromJson(jsonLine, YtProcessStatus.class);
            if (ytProcessStatus != null && ytProcessStatus.getStatus() != null) {
//                MirrorStatus.DownloadStatus downloadStatus = new MirrorStatus.DownloadStatus(
//                        ytProcessStatus.getDownloaded_bytes(),
//                        ytProcessStatus.getTotal_bytes()
//                );
                statusService.updateMirrorStatusWithDownloadState(mirrorStatus.getId(), ytProcessStatus.getDownloaded_bytes());
            }
        } catch (JsonSyntaxException ex) {
            log.error("Failed to parse download progress: {}", ex.getMessage());
        }
    }

    private void updateFileNames(MirrorStatus mirrorStatus) throws IOException, InterruptedException {
        String[] tempArray = getYtOutputFileName(mirrorStatus).split("\\.");
        String fileExtension = "." + tempArray[tempArray.length - 1];
        mirrorStatus.setFileName(mirrorStatus.getFileName() + fileExtension);
        mirrorStatus.setFilePath(mirrorStatus.getFilePath() + fileExtension);
        mirrorStatus.setTempFileName(mirrorStatus.getTempFileName() + fileExtension);
        mirrorStatus.setTempFilePath(mirrorStatus.getTempFilePath() + fileExtension);
        statusService.updateStatus(mirrorStatus);
    }

    private void moveDownloadedFile(MirrorStatus mirrorStatus) throws IOException {
        FileUtils.moveFile(
                new File(mirrorStatus.getTempFilePath()),
                new File(mirrorStatus.getFilePath()),
                StandardCopyOption.REPLACE_EXISTING
        );
    }

    private void handleDownloadError(MirrorStatus mirrorStatus, Exception e) {
        log.error("Download failed: {}", e.getMessage());
        statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), e.getMessage());
        throw new DbWorldException(e.getMessage());
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
        MirrorStatus mirrorStatus = statusService.getStatusById(statusId);
        List<String> cmdList = new ArrayList<>(Arrays.asList(
                DbWorldConstants.YT_DLP,
                "--progress-template", "\"%(progress)j\""
        ));

        if (url.contains(DbWorldConstants.HOTSTAR_COM)) {
            cmdList.addAll(Arrays.asList(DbWorldConstants.YTDLP_COOKIES_CMD, DbWorldConstants.HS_COOKIES_PATH));
        }

        // Detect OS
        boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");


        switch (processType) {
            case PROCESS_INFO:
                cmdList.addAll(Arrays.asList(url, "-J"));
                break;

            case PROCESS_DOWNLOAD:

                // Properly escape paths for both OS
                String outputFilePath = mirrorStatus.getTempFilePath() + ".%(ext)s";
                if (isWindows) {
                    outputFilePath = "\"" + outputFilePath + "\""; // Double quotes for Windows
                } else {
                    outputFilePath = outputFilePath.replace(" ", "\\ "); // Escape spaces for Linux
                }

                cmdList.add("-f");
                cmdList.add(getBestVideoAudioFormat(mirrorStatus.getVideoITag(), mirrorStatus.getAudioITag()));
                cmdList.add("-o");
                cmdList.add(outputFilePath);
                cmdList.add(url);
                break;

            case PROCESS_FILENAME:
                cmdList.add("-f");
                cmdList.add(getBestVideoAudioFormat(mirrorStatus.getVideoITag(), mirrorStatus.getAudioITag()));
                cmdList.add("--get-filename");
                cmdList.add(url);
                break;
        }

        cmdList.removeIf(String::isEmpty);
        log.info("Running [{}] command: {}", processType, String.join(" ", cmdList));
        return cmdList;
    }



    private String getBestAudioFormat(String audioITag) {
        return (audioITag == null || audioITag.isEmpty() || "0".equals(audioITag)) ? "bestaudio" : audioITag;
    }

    private String getBestVideoAudioFormat(String videoITag, String audioITag) {
        return String.format("%s+%s/best",
                Optional.ofNullable(videoITag).orElse("bestvideo"),
                getBestAudioFormat(audioITag)
        );
    }


    @Override
    public HttpHeaders getHeaders(String httpUrl) {

        try {
            URL url = new URL(httpUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("HEAD");

            log.info("connection.getResponseMessage(): {}", connection.getResponseMessage());
            log.info("connection.getResponseCode(): {}", connection.getResponseCode());
            log.info("connection.getContentLengthLong(): {}", connection.getContentLengthLong());
            log.info("connection.getErrorStream(): {}", connection.getErrorStream());
            log.info("connection.getHeaderField(): {}", connection.getHeaderField("Content-Disposition"));

        } catch (Exception ex) {
            log.error(ex.getMessage());
            throw new DbWorldException(ex.getMessage());
        }

        try {
            RestTemplate restTemplate = new RestTemplate();
            return restTemplate.execute(httpUrl, HttpMethod.HEAD,
                    request -> request.getHeaders().set("Host", httpUrl.split("/")[2]),
                    HttpMessage::getHeaders);
        } catch (WebClientResponseException ex) {
            log.error(ex.getMessage());
            return ex.getHeaders();
        } catch (ResourceAccessException ex) {
            log.error(ex.getMessage());
            return null;
        }
    }


}
