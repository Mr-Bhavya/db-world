package com.db.dbworld.controllers;

import com.db.dbworld.exceptions.DbWorldException;
import com.db.dbworld.exceptions.ResourceNotFoundException;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.payloads.MirrorStatus;
import com.db.dbworld.payloads.RequestPayloads;
import com.db.dbworld.services.StatusService;
import com.db.dbworld.services.UtilsService;
import com.db.dbworld.utils.DbWorldConstants;
import com.db.dbworld.utils.DbWorldUtils;
import com.google.gson.JsonObject;
import com.sun.management.OperatingSystemMXBean;
import lombok.extern.log4j.Log4j2;
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
import java.util.stream.Collectors;

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


//    @GetMapping(value = "/logs")
//    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
//    public ApiResponse getLogs() {
//        List logs = dbWorldUtils.readFileInList(DbWorldConstants.LOGS_FILE_PATH);
//        return new ApiResponse(HttpStatus.OK, true, "Info Logs", logs);
//    }

    @DeleteMapping(value = "/tempFiles")
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> deleteTempFiles() {
        utilsService.deleteTempFiles();
        return new ApiResponse<>(HttpStatus.OK, true, "Temporary files are deleted.");
    }

    @RequestMapping(value = "/mirror", method = RequestMethod.POST)
    @PreAuthorize(DbWorldConstants.OWNER_ADMIN_AUTHORIZE)
    public ApiResponse<String> mirror(@RequestBody RequestPayloads.Mirror mirror) {

        URL url;
        String fileName;
        long contentLength;
        String contentDisposition;
        HttpURLConnection connection;

        if (mirror.getUrl().startsWith("http") || mirror.getUrl().startsWith("https")) {
            if (mirror.isUrlProtected() && mirror.getUrl().contains("https://")) {
                mirror.setUrl(mirror.getUrl().replace("https://", "https://" + mirror.getUsername() + ":" + mirror.getPassword() + "@"));
            } else if (mirror.isUrlProtected() && mirror.getUrl().contains("http://")) {
                mirror.setUrl(mirror.getUrl().replace("http://", "http://" + mirror.getUsername() + ":" + mirror.getPassword() + "@"));
            }

            try {
                url = new URL(mirror.getUrl());
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("HEAD");
                log.info("Response Code: {} for retrieve headers from URL: {}",connection.getResponseCode(), url.toString());
                contentDisposition = connection.getHeaderField("Content-Disposition");
                contentLength = connection.getContentLengthLong(); //default is -1
                connection.disconnect();
            } catch (IOException e) {
                throw new DbWorldException(e.getMessage());
            }

            if (contentDisposition == null || contentDisposition.isBlank()) {
                if (mirror.isRename()) {
                    fileName = mirror.getFileName();
                } else
                    throw new DbWorldException("Not able to retrieve fileName from url. Please try again with rename option.");
            } else {
                fileName = mirror.isRename() ? mirror.getFileName() : dbWorldUtils.decodeFileName(ContentDisposition.parse(contentDisposition).getFilename());
            }

            mirrorStatus = new MirrorStatus(
                    mirror.getFolderName(),
                    mirror.getUrl(),
                    fileName,
                    contentLength,
                    mirror.isExtract()
            );

            log.info("Download file: '{}' from url: '{}'.", mirrorStatus.getFileName(), mirrorStatus.getFileUrl());
            statusService.addNewStatus(mirrorStatus);
            utilsService.downloadHttpFile_1(mirrorStatus);
        } else if (mirror.getUrl().startsWith("magnet:?")) {

            fileName = Arrays.stream(mirror.getUrl().split("&")).filter(s -> s.contains("dn=")).collect(Collectors.joining()).replace("dn=", "");
            mirrorStatus = new MirrorStatus(
                    mirror.getFolderName(),
                    mirror.getUrl(),
                    dbWorldUtils.decodeFileName(fileName),
                    0L,
                    mirror.isExtract()
            );
            utilsService.downloadMagnetFile(mirrorStatus);
        }
        return new ApiResponse<>(HttpStatus.OK, true, "Task added. task id: " + mirrorStatus.getId());
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
