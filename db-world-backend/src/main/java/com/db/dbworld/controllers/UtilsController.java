package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.services.mirror.StatusService;
import com.db.dbworld.services.mirror.UtilsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.JsonObject;
import com.sun.management.OperatingSystemMXBean;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@RestController
@Log4j2
@RequestMapping(value = "/api/utils")
@EnableMethodSecurity(prePostEnabled = true)
@CrossOrigin
public class UtilsController {

    @Autowired
    private DbWorldUtils dbWorldUtils;

    @Autowired
    private UtilsService utilsService;

    @Autowired
    private MirrorStatus mirrorStatus;

    @Autowired
    private StatusService statusService;

    @DeleteMapping(value = "/tempFiles")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteTempFiles() {
        utilsService.deleteTempFiles();
        return new ApiResponse<>(HttpStatus.OK, true, "Temporary files are deleted.");
    }

    @PostMapping("/mirror")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> mirror(@RequestBody RequestPayloads.Mirror mirror) {
        List<String> validUrls = new ArrayList<>();
        List<String> invalidUrls = new ArrayList<>();

        // 1. Validate all URLs
        for (String url : mirror.getUrls()) {
            if (isValidUrl(url, mirror)) {
                validUrls.add(url);
            } else {
                invalidUrls.add(url);
            }
        }

        // 2. Return immediate response
        String summary = String.format("Total: %d, Valid: %d, Invalid: %d", mirror.getUrls().size(), validUrls.size(), invalidUrls.size());
        log.info("[MIRROR] Validation Summary: {}", summary);

        // 3. Begin processing valid URLs in a queue (sequentially)
        ExecutorService executor = Executors.newSingleThreadExecutor();
        executor.submit(() -> {
            for (String url : validUrls) {
                try {
                    processSingleUrl(url, mirror);
                } catch (Exception e) {
                    log.error("Error processing URL: {}", url, e);
                }
            }
        });

        return new ApiResponse<>(HttpStatus.OK, true, summary + ". Download started for valid URLs.");
    }

    private boolean isValidUrl(String url, RequestPayloads.Mirror mirror) {
        if (url.startsWith("magnet:?")) return true;

        try {
            String processedUrl = processAuthUrl(url, mirror);
            HttpURLConnection connection = (HttpURLConnection) new URL(processedUrl).openConnection();
            connection.setRequestMethod("HEAD");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            int responseCode = connection.getResponseCode();
            connection.disconnect();
            return responseCode >= 200 && responseCode < 400;
        } catch (IOException e) {
            log.warn("URL validation failed for {}: {}", url, e.getMessage());
            return false;
        }
    }

    private void processSingleUrl(String url, RequestPayloads.Mirror mirror) throws Exception {
        if (url.startsWith("magnet:?")) {
            String fileName = Arrays.stream(url.split("&"))
                    .filter(s -> s.contains("dn="))
                    .map(s -> s.replace("dn=", ""))
                    .findFirst().orElse("magnet_file");

            MirrorStatus mirrorStatus = new MirrorStatus(
                    mirror.getFolderName(),
                    url,
                    dbWorldUtils.decodeFileName(fileName),
                    0L,
                    mirror.isExtract()
            );
            utilsService.downloadFileUsingAria2c(mirrorStatus);
            return;
        }

        // HTTP(S) case
        String processedUrl = processAuthUrl(url, mirror);
        HttpURLConnection connection = (HttpURLConnection) new URL(processedUrl).openConnection();
        connection.setRequestMethod("HEAD");
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);

        int responseCode = connection.getResponseCode();
        if (responseCode >= 400) {
            throw new DbWorldException("URL not downloadable (code " + responseCode + "): " + url);
        }

        String contentDisposition = connection.getHeaderField("Content-Disposition");
        long contentLength = connection.getContentLengthLong();
        connection.disconnect();

        String fileName;
        if (StringUtils.isBlank(contentDisposition)) {
            if (mirror.isRename()) {
                fileName = mirror.getFileName();
            } else {
                throw new DbWorldException("Cannot determine filename. Use rename option for: " + url);
            }
        } else {
            fileName = mirror.isRename()
                    ? mirror.getFileName()
                    : dbWorldUtils.decodeFileName(ContentDisposition.parse(contentDisposition).getFilename());
        }

        MirrorStatus mirrorStatus = new MirrorStatus(
                mirror.getFolderName(),
                url,
                fileName,
                contentLength,
                mirror.isExtract()
        );

        log.info("Queueing file for download: '{}' from '{}'", mirrorStatus.getFileName(), url);
        statusService.addNewStatus(mirrorStatus);
        utilsService.downloadFileUsingAria2c(mirrorStatus);
    }

    private String processAuthUrl(String url, RequestPayloads.Mirror mirror) {
        if (!mirror.isUrlProtected()) return url;

        String auth = mirror.getUsername() + ":" + mirror.getPassword() + "@";
        if (url.startsWith("https://")) {
            return url.replace("https://", "https://" + auth);
        } else if (url.startsWith("http://")) {
            return url.replace("http://", "http://" + auth);
        }
        return url;
    }

    @RequestMapping(value = "/mirror/{mirrorId}", method = RequestMethod.DELETE)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> mirrorCancelled(@PathVariable String mirrorId) {
        MirrorStatus mirrorStatus = statusService.getStatusById(mirrorId);
        mirrorStatus.setCancelled(true);
        statusService.updateStatus(mirrorStatus);
        return new ApiResponse<>(HttpStatus.OK, true, "Task Cancelled.");
    }

    @GetMapping(value = "/mirror/status")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<List<MirrorStatus>> getAllStatus() {
        Map<String, MirrorStatus> mirrorStatusMap = statusService.getAllStatus();
        List<MirrorStatus> mirrorStatuses = new ArrayList<>(mirrorStatusMap.values().stream().sorted((o1, o2) -> o2.getTimeStamp().compareTo(o1.getTimeStamp())).toList());
        return new ApiResponse<>(HttpStatus.OK, true, mirrorStatuses);
    }

    @RequestMapping(value = "/mirror/status/{statusId}", method = RequestMethod.DELETE)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> mirrorDelete(@PathVariable String statusId) {
        Map<String, MirrorStatus> mirrorStatusMap = statusService.getAllStatus();
        if (mirrorStatusMap.containsKey(statusId)) {
            MirrorStatus mirrorStatus = mirrorStatusMap.get(statusId);
            if (mirrorStatus.isCompleted()) {
                statusService.deleteStatus(statusId);
            } else {
                log.info("Status '{}' is not completed.", statusId);
                throw new DbWorldException(String.format("Status '%s' is not completed.", statusId));
            }
        } else {
            throw new ResourceNotFoundException("Mirror Status", "id", statusId);
        }
        return new ApiResponse<>(HttpStatus.OK, true, "Task Status Deleted.");
    }

    @RequestMapping(value = "/yt/info", method = RequestMethod.GET, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<JsonObject> ytInfo(@RequestParam String url) throws IOException {
        JsonObject jsonInfo = utilsService.getInfoYtFile(url);
        return new ApiResponse<>(HttpStatus.OK, true, "Success", jsonInfo);
    }

    @RequestMapping(value = "/yt/download", method = RequestMethod.POST)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> ytDownload(@RequestBody RequestPayloads.Mirror mirror) throws IOException {
        mirrorStatus = new MirrorStatus(
                mirror.getFolderName(),
                mirror.getUrl(),
                dbWorldUtils.decodeFileName(mirror.getFileName()),
                mirror.getFileSize(),
                mirror.isExtract(),
                mirror.getVideoITag(),
                mirror.getAudioITag(),
                mirror.isOnlyAudio()

        );
        utilsService.downloadYtFile(mirrorStatus);
        return new ApiResponse<>(HttpStatus.OK, true, "Task Added.");
    }

    @RequestMapping(value = "/system-info", method = RequestMethod.GET)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<Map<String, Object>> getSystemInfo() {
        Map<String, Object> osInfoMap = new HashMap<>();
        OperatingSystemMXBean os = (OperatingSystemMXBean) ManagementFactory.getOperatingSystemMXBean();

        List<File> roots = new ArrayList<>(Arrays.stream(File.listRoots()).toList());
        roots.add(new File(DbWorldConstants.EXTERNAL_H_DISK_PATH));

        List<Map<String, Object>> rom = roots.stream().map(file -> {
            Map<String, Object> temp = new HashMap<>();
            temp.put("name", file.getAbsolutePath());
            temp.put("totalSpace", file.getTotalSpace());
            temp.put("freeSpace", file.getFreeSpace());
            temp.put("usedSpace", file.getTotalSpace() - file.getFreeSpace());
            return temp;
        }).toList();

        Map<String, Object> ram = new HashMap<>();
        ram.put("totalSpace", os.getTotalMemorySize());
        ram.put("freeSpace", os.getFreeMemorySize());
        ram.put("usedSpace", os.getTotalMemorySize() - os.getFreeMemorySize());
        ram.put("freeSwapSpace", os.getFreeSwapSpaceSize());
        ram.put("committedVirtualSpace", os.getCommittedVirtualMemorySize());

        Map<String, Object> cpu = new HashMap<>();
        cpu.put("availableProcessors", os.getAvailableProcessors());
        cpu.put("processCpuTime", os.getProcessCpuTime());
        cpu.put("cpuLoad", os.getCpuLoad());

        osInfoMap.put("name", os.getName());
        osInfoMap.put("arch", os.getArch());
        osInfoMap.put("ram", ram);
        osInfoMap.put("rom", rom);
        osInfoMap.put("cpu", cpu);

        return new ApiResponse<>(HttpStatus.OK, true, osInfoMap);
    }


}
