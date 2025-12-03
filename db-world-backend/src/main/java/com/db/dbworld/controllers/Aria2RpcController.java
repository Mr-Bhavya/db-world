package com.db.dbworld.controllers;

import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.services.aria2.Aria2RpcService;
import com.db.dbworld.services.aria2.model.Aria2GlobalStat;
import com.db.dbworld.services.aria2.model.Aria2StatusParam;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Log4j2
@RestController
@RequestMapping("/api/downloads")
public class Aria2RpcController {

    private final Aria2RpcService aria2RpcService;

    @Autowired
    public Aria2RpcController(Aria2RpcService aria2RpcService) {
        this.aria2RpcService = aria2RpcService;
    }

    @PostMapping("/{gid}/cancel")
    public ApiResponse<String> cancelDownload(@PathVariable String gid) {
        aria2RpcService.remove(gid);
        return new ApiResponse<>(HttpStatus.OK, true, "Download cancelled successfully");
    }

    @GetMapping("/{gid}/status")
    public ApiResponse<Aria2StatusParam> getDownloadStatus(@PathVariable String gid) {
        Aria2StatusParam status = aria2RpcService.tellStatus(gid);
        return new ApiResponse<>(HttpStatus.OK, true,status);
    }

    @PostMapping("/{gid}/pause")
    public ApiResponse<String> pauseDownload(@PathVariable String gid) {
        aria2RpcService.pause(gid);
        return new ApiResponse<>(HttpStatus.OK, true,"Download paused successfully for GID: " + gid);
    }

    @PostMapping("/{gid}/resume")
    public ApiResponse<String> resumeDownload(@PathVariable String gid) {
        aria2RpcService.unpause(gid);
        return new ApiResponse<>(HttpStatus.OK, true,"Download resumed successfully for GID: " + gid);
    }

    @GetMapping("/queue/status")
    public ApiResponse<Aria2GlobalStat> getQueueStatus() {
        Aria2GlobalStat globalStats = aria2RpcService.getGlobalStat();
        return new ApiResponse<>(HttpStatus.OK, true,globalStats);
    }

    @GetMapping("/active")
    public ApiResponse<List<Aria2StatusParam>> getActiveDownloads() {
        List<Aria2StatusParam> activeDownloads = aria2RpcService.getActiveDownloads();
        return new ApiResponse<>(HttpStatus.OK, true,activeDownloads);
    }

    @GetMapping("/waiting")
    public ApiResponse<List<Aria2StatusParam>> getWaitingDownloads() {
        List<Aria2StatusParam> waitingDownloads = aria2RpcService.getWaitingDownloads(0, 100);
        return new ApiResponse<>(HttpStatus.OK, true,waitingDownloads);
    }
}