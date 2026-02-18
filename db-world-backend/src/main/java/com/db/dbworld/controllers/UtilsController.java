package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.factory.MirrorStatusFactory;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.MirrorState;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.services.mirror.HttpDownloadQueueService;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.services.mirror.UtilsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.JsonObject;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URL;
import java.nio.file.Paths;
import java.util.*;

@RestController
@Log4j2
@RequestMapping("/api/utils")
@CrossOrigin
public class UtilsController {

    private final DbWorldUtils dbWorldUtils;
    private final UtilsService utilsService;
    private final StatusService statusService;
    private final MirrorStatusFactory mirrorStatusFactory;
    private final HttpDownloadQueueService httpQueueService;

    public UtilsController(
            DbWorldUtils dbWorldUtils,
            UtilsService utilsService,
            StatusService statusService,
            MirrorStatusFactory mirrorStatusFactory,
            HttpDownloadQueueService httpQueueService
    ) {
        this.dbWorldUtils = dbWorldUtils;
        this.utilsService = utilsService;
        this.statusService = statusService;
        this.mirrorStatusFactory = mirrorStatusFactory;
        this.httpQueueService = httpQueueService;
    }

    /* =========================================================
       TEMP FILES
       ========================================================= */

    @DeleteMapping("/tempFiles")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteTempFiles() {
        utilsService.deleteTempFiles();
        return ApiResponse.success("Temporary files deleted successfully");
    }

    /* =========================================================
       MIRROR
       ========================================================= */

    @PostMapping("/mirror")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> mirror(@RequestBody RequestPayloads.Mirror mirror) {

        List<String> urls = mirror.getUrls();
        log.info("[MIRROR] Received {} URLs", urls.size());

        int success = 0;
        List<String> errors = new ArrayList<>();

        for (String url : urls) {
            try {
                if (url.startsWith("magnet:?")) {
                    processMagnet(url, mirror);
                } else if (url.startsWith("http://") || url.startsWith("https://")) {
                    processHttp(url, mirror);
                } else {
                    errors.add("Unsupported URL: " + url);
                    continue;
                }
                success++;
            } catch (Exception e) {
                log.error("Mirror failed for URL={}", url, e);
                errors.add("Failed: " + url + " - " + e.getMessage());
            }
        }

        if (errors.isEmpty()) {
            return ApiResponse.success(
                    String.format("All %d URLs queued successfully", success)
            );
        }

        return ApiResponse.success(
                String.format(
                        "Processed %d URLs, %d failed. Errors: %s",
                        success,
                        errors.size(),
                        String.join("; ", errors)
                )
        );
    }

    /* =========================================================
       MAGNET (NO QUEUE)
       ========================================================= */

    private void processMagnet(String url, RequestPayloads.Mirror mirror) {

        String fileName = Arrays.stream(url.split("&"))
                .filter(s -> s.startsWith("dn="))
                .map(s -> s.substring(3))
                .findFirst()
                .orElse("magnet_file");

        MirrorStatus status = mirrorStatusFactory.create(
                mirror.getFolderName(),
                url,
                dbWorldUtils.decodeFileName(fileName),
                0L,
                mirror.isExtract()
        );

        statusService.addNewStatus(status);

        log.info("Starting magnet immediately: {}", status.getFileName());
        utilsService.downloadFileUsingAria2c(status);
    }

    /* =========================================================
       HTTP (QUEUE + AUTH)
       ========================================================= */

    private void processHttp(String url, RequestPayloads.Mirror mirror) throws Exception {

        String fileName = mirror.isRename()
                ? mirror.getFileName()
                : extractFileName(url);

        MirrorStatus status = mirrorStatusFactory.create(
                mirror.getFolderName(),
                url,
                fileName,
                0L,
                mirror.isExtract()
        );

        // Attach auth metadata (DO NOT embed in URL)
        if (mirror.isUrlProtected()) {
            status.setUrlUsername(mirror.getUsername());
            status.setUrlPassword(mirror.getPassword());
            status.setUrlProtected(mirror.isUrlProtected());
        }

        statusService.addNewStatus(status);

        // Enqueue instead of starting immediately
        httpQueueService.enqueue(status);
    }

    private String extractFileName(String url) {
        try {
            String path = new URL(url).getPath();
            String name = Paths.get(path).getFileName().toString();
            return StringUtils.isNotBlank(name)
                    ? dbWorldUtils.decodeFileName(name)
                    : "unknown_file";
        } catch (Exception e) {
            return "unknown_file";
        }
    }

    /* =========================================================
       MIRROR STATUS
       ========================================================= */

    @DeleteMapping("/mirror/{mirrorId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> cancelMirror(@PathVariable String mirrorId) {

        boolean updated = statusService.updateMirrorState(mirrorId, MirrorState.CANCELLED);
        if (!updated) {
            throw new DbWorldException("Failed to cancel mirror task");
        }

        return ApiResponse.success("Task cancelled successfully");
    }

    @GetMapping("/mirror/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<Map<String, Object>>> getAllStatus() {

        List<String> queueSnapshot = httpQueueService.getQueueSnapshot();

        List<Map<String, Object>> result =
                statusService.getAllStatus()
                        .values()
                        .stream()
                        .sorted(Comparator.comparing(MirrorStatus::getTimeStamp).reversed())
                        .map(status -> {

                            Map<String, Object> map = new HashMap<>();
                            map.put("status", status);

                            int idx = queueSnapshot.indexOf(status.getId());
                            boolean isQueued = idx >= 0;

                            map.put("isQueued", isQueued);
                            map.put("queuePosition", isQueued ? idx + 1 : null);

                            return map;
                        })
                        .toList();

        return ApiResponse.success(result);
    }

    @DeleteMapping("/mirror/status/{statusId}")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> deleteMirrorStatus(@PathVariable String statusId) {

        MirrorStatus status = Optional.ofNullable(statusService.getAllStatus().get(statusId))
                .orElseThrow(() ->
                        new ResourceNotFoundException("Mirror Status", "id", statusId)
                );

        if (!status.isCompleted()) {
            throw new DbWorldException("Mirror task is not completed");
        }

        statusService.deleteStatus(statusId);
        return ApiResponse.success("Task status deleted");
    }

    /* =========================================================
       YOUTUBE (NO QUEUE)
       ========================================================= */

    @GetMapping("/yt/info")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<JsonObject> ytInfo(@RequestParam String url) throws IOException {
        return ApiResponse.success(utilsService.getInfoYtFile(url));
    }

    @PostMapping("/yt/download")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Void> ytDownload(@RequestBody RequestPayloads.Mirror mirror) throws IOException {

        MirrorStatus status = mirrorStatusFactory.create(
                mirror.getFolderName(),
                mirror.getUrl(),
                dbWorldUtils.decodeFileName(mirror.getFileName()),
                mirror.getFileSize(),
                mirror.isExtract(),
                mirror.getVideoITag(),
                mirror.getAudioITag(),
                mirror.isOnlyAudio()
        );

        statusService.addNewStatus(status);
        utilsService.downloadYtFile(status);
        return ApiResponse.success("YouTube download task added");
    }
}

