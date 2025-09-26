package com.db.dbworld.services.mirror.impl;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.helpers.MirrorHelper;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.services.aria2.Aria2RpcService;
import com.db.dbworld.services.aria2.Aria2WebSocketClientService;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.services.mirror.UtilsService;
import com.db.dbworld.stream.processor.StreamLogger;
import com.db.dbworld.stream.processor.StreamProcessor;
import com.db.dbworld.stream.processor.YtDlpStreamProcessor;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.io.FileUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
@Log4j2
public class UtilsServiceImpl implements UtilsService {

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private StatusService statusService;

    @Autowired
    private Aria2RpcService aria2RpcService;

    @Autowired
    private MirrorHelper mirrorHelper;

    @Autowired
    private Aria2WebSocketClientService wsClientService;

    private static final String PROCESS_DOWNLOAD = "PROCESS_DOWNLOAD";
    private static final String PROCESS_AUDIO = "PROCESS_AUDIO";
    private static final String PROCESS_INFO = "PROCESS_INFO";
    private static final String PROCESS_FILENAME = "PROCESS_FILENAME";

    @Async
    @Override
    public void downloadFileUsingAria2c(MirrorStatus mirrorStatus) {
        try {
            // Register the download first
            statusService.addNewStatus(mirrorStatus);

            // Prepare download options
            Map<String, Object> options = new HashMap<>();
            options.put("dir", Paths.get(mirrorStatus.getTempRecordIdPath()).toString());

            if (!mirrorStatus.isMagnet()) {
                options.put("out", Paths.get(mirrorStatus.getTempFilePath()).getFileName().toString());

                // Set range header if resuming
                if (mirrorStatus.getDownloadStatus() != null &&
                        mirrorStatus.getDownloadStatus().getFileDownloaded() > 0) {
                    Map<String, String> headers = new HashMap<>();
                    headers.put("Range", "bytes=" + mirrorStatus.getDownloadStatus().getFileDownloaded() + "-");
                    options.put("header", headers);
                }
            }

            // Start the download via Aria2 RPC
            String gid = aria2RpcService.addUri(mirrorStatus.getFileUrl(), options).block();

            // Register for WebSocket updates
            wsClientService.startDownloadMonitoring(gid, mirrorStatus.getId());

        } catch (Exception e) {
            log.error("Download failed: {}", e.getMessage(), e);
            statusService.updateMirrorStatusWithFailed(mirrorStatus.getId(), e.getMessage());
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
                dbWorldUtils.deleteFileOrDirectory(file.getAbsolutePath(), false);
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
            StreamProcessor stderr = new YtDlpStreamProcessor(statusService, mirrorStatus, () -> {
            });

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

}
