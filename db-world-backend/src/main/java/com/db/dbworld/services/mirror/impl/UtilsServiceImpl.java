//package com.db.dbworld.services.mirror.impl;
//
//import com.db.dbworld.core.exception.DbWorldException;
//import com.db.dbworld.core.exception.ProcessExecutionException;
//import com.db.dbworld.helpers.MirrorHelper;
//import com.db.dbworld.helpers.ProcessExecutor;
//import com.db.dbworld.payloads.MirrorStatus;
//import com.db.dbworld.services.aria2.Aria2RpcService;
//import com.db.dbworld.services.aria2.Aria2WebSocketClientService;
//import com.db.dbworld.services.mirror.StatusService;
//import com.db.dbworld.services.mirror.UtilsService;
//import com.db.dbworld.core.processor.StreamLogger;
//import com.db.dbworld.core.processor.StreamProcessor;
//import com.db.dbworld.core.processor.StreamProcessorFactory;
//import com.db.dbworld.core.processor.YtDlpStreamProcessor;
//import com.db.dbworld.utils.DbWorldConstants;
//import com.db.dbworld.utils.DbWorldUtils;
//import com.google.gson.Gson;
//import com.google.gson.JsonObject;
//import lombok.extern.log4j.Log4j2;
//import org.apache.commons.io.FileUtils;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.scheduling.annotation.Async;
//import org.springframework.stereotype.Service;
//
//import java.io.*;
//import java.nio.file.Paths;
//import java.nio.file.StandardCopyOption;
//import java.util.*;
//import java.util.concurrent.atomic.AtomicBoolean;
//
//@Service
//@Log4j2
//public class UtilsServiceImpl implements UtilsService {
//
//    @Autowired
//    private DbWorldUtils dbWorldUtils;
//
//    @Autowired
//    private StatusService statusService;
//
//    @Autowired
//    private Aria2RpcService aria2RpcService;
//
//    @Autowired
//    private MirrorHelper mirrorHelper;
//
//    @Autowired
//    private ProcessExecutor processExecutor;
//
//    @Autowired
//    private Aria2WebSocketClientService wsClientService;
//
//    private static final String PROCESS_DOWNLOAD = "PROCESS_DOWNLOAD";
//    private static final String PROCESS_AUDIO = "PROCESS_AUDIO";
//    private static final String PROCESS_INFO = "PROCESS_INFO";
//    private static final String PROCESS_FILENAME = "PROCESS_FILENAME";
//
//    //    @Async
//    @Override
//    public void downloadFileUsingAria2c(MirrorStatus mirrorStatus) {
//        try {
//            // Register the download first
//            statusService.addNewStatus(mirrorStatus);
//
//            // Prepare download options
//            Map<String, Object> options = new HashMap<>();
//            options.put("dir", Paths.get(mirrorStatus.getTempRecordIdPath()).toString());
//            if(mirrorStatus.isUrlProtected()) {
//                options.put("http-user", mirrorStatus.getUrlUsername());
//                options.put("http-passwd", mirrorStatus.getUrlPassword());
//            }
//
//            if (!mirrorStatus.isMagnet()) {
//                // Set range header if resuming
//                if (mirrorStatus.getDownloadStatus() != null &&
//                        mirrorStatus.getDownloadStatus().getFileDownloaded() > 0) {
//                    Map<String, String> headers = new HashMap<>();
//                    headers.put("Range", "bytes=" + mirrorStatus.getDownloadStatus().getFileDownloaded() + "-");
//                    options.put("header", headers);
//                }
//            }
//
//            // Start the download via Aria2 RPC - SYNC VERSION
//            String gid = aria2RpcService.addUri(mirrorStatus.getId(), mirrorStatus.getFileUrl(), options).getGid();
//
//            log.info("Download started successfully. GID: {}, MirrorId: {}", gid, mirrorStatus.getId());
//
//            // Register for WebSocket updates (if needed)
//            wsClientService.startDownloadMonitoring(gid, mirrorStatus.getId());
//
//        } catch (Exception e) {
//            log.error("Download failed for MirrorId {}: {}", mirrorStatus.getId(), e.getMessage(), e);
//            statusService.logAndAppendHtml(mirrorStatus, e.getMessage(), true);
//            throw new RuntimeException("Download failed: " + e.getMessage(), e);
//        }
//    }
//
//    @Override
//    public void deleteTempFiles() {
//        File[] listFiles = new File(DbWorldConstants.TEMP_DOWNLOAD_PATH).listFiles();
//        if (listFiles != null && listFiles.length != 0) {
//            Arrays.stream(listFiles).forEach(file -> {
//                dbWorldUtils.deleteFileOrDirectory(file.getAbsolutePath(), false);
//            });
//        }
//    }
//
//    @Override
//    public JsonObject getInfoYtFile(String url) {
//
//        try {
//
//            StreamProcessor streamProcessor = StreamProcessorFactory.createYtDlpProcessor();
//
//            String output = processExecutor.runYtDlpCommand(getYtCommand(url, PROCESS_INFO, null), streamProcessor, new AtomicBoolean(false));
//
//            if (isNullOrBlankJson(output)) {
//                throw new DbWorldException("yt-dlp returned empty output for URL: " + url);
//            }
//
//            JsonObject result = new Gson().fromJson(output.replace("null\n", ""), JsonObject.class);
//            if (result == null || result.isJsonNull() || result.entrySet().isEmpty()) {
//                throw new DbWorldException("Failed to parse yt-dlp output JSON for URL: " + url);
//            }
//
//            log.info("yt-dlp info fetched successfully for url {}", url);
//            return result;
//
//        } catch (ProcessExecutionException e) {
//            throw new DbWorldException("Failed to execute yt-dlp command: " + e.getMessage(), e);
//        }
//    }
//
//    private boolean isNullOrBlankJson(String input) {
//        return input == null || input.isBlank() || "null".equalsIgnoreCase(input.trim()) || "{}".equals(input.trim());
//    }
//
//    @Async
//    @Override
//    public void downloadYtFile(MirrorStatus mirrorStatus) {
//        statusService.addNewStatus(mirrorStatus);
//        try {
//            YtDlpStreamProcessor processor = StreamProcessorFactory.createYtDlpProcessor(statusService, mirrorStatus);
//            String output = processExecutor.runYtDlpCommand(getYtCommand(
//                            mirrorStatus.getFileUrl(),
//                            PROCESS_DOWNLOAD,
//                            mirrorStatus.getId()
//                    ), processor, new AtomicBoolean(false)
//            );
//            String filename = Arrays.stream(output.split("\\R"))
//                    .map(String::trim)
//                    .filter(line -> !line.isEmpty())
//                    .map(line -> Paths.get(line).getFileName().toString())
//                    .reduce((first, second) -> second) // last printed filename
//                    .orElseThrow(() ->
//                            new DbWorldException("yt-dlp did not return filename")
//                    );
//            mirrorStatus.setFileName(filename);
//            mirrorStatus.setTempFileName(filename);
//            moveDownloadedFile(mirrorStatus);
//            statusService.updateMirrorStatusWithSuccess(mirrorStatus.getId());
//        } catch (Exception ex) {
//            StreamLogger.appendHtmlLine(mirrorStatus, ex.getMessage(), true, statusService);
//        }
//    }
//
//    private String getBestAudioFormat(String audioITag) {
//        return (audioITag == null || audioITag.isEmpty() || "0".equals(audioITag)) ? "bestaudio" : audioITag;
//    }
//
//    private String getBestVideoAudioFormat(String videoITag, String audioITag) {
//        return Optional.ofNullable(videoITag).orElse("bestvideo") + "+" + getBestAudioFormat(audioITag) + "/best";
//    }
//
//    private void moveDownloadedFile(MirrorStatus mirrorStatus) throws IOException {
//        FileUtils.moveFile(
//                new File(mirrorStatus.getTempFilePath()),
//                new File(mirrorStatus.getFilePath()),
//                StandardCopyOption.REPLACE_EXISTING
//        );
//    }
//
//    private List<String> getYtCommand(String url, String processType, String statusId) {
//
//        MirrorStatus mirrorStatus =
//                statusId != null ? statusService.getStatusById(statusId) : null;
//
//        List<String> cmd = new ArrayList<>(List.of(
//                "--progress-template", "%(progress)j"
//        ));
//
//        if (url.contains(DbWorldConstants.HOTSTAR_COM)) {
//            cmd.addAll(List.of(
//                    DbWorldConstants.YTDLP_COOKIES_CMD,
//                    DbWorldConstants.HS_COOKIES_PATH
//            ));
//        }
//
//        switch (processType) {
//
//            case PROCESS_INFO -> cmd.addAll(List.of(
//                    "-J",
//                    url
//            ));
//
//            case PROCESS_DOWNLOAD -> cmd.addAll(List.of(
//                    "-f", getBestVideoAudioFormat(
//                            mirrorStatus.getVideoITag(),
//                            mirrorStatus.getAudioITag()
//                    ),
//                    "-o", mirrorStatus.getTempFilePath() + ".%(ext)s",
//                    "--print", "after_move:filename",
//                    url
//            ));
//        }
//
//        return cmd;
//    }
//
//
//}
