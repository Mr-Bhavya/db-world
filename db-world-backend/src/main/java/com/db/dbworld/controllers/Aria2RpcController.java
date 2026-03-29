//package com.db.dbworld.controllers;
//
//import com.db.dbworld.payloads.ApiResponse;
//import com.db.dbworld.services.aria2.Aria2RpcService;
//import com.db.dbworld.services.aria2.model.Aria2GlobalStat;
//import com.db.dbworld.services.aria2.model.Aria2StatusParam;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.web.bind.annotation.*;
//
//import java.util.List;
//
//@Log4j2
//@RestController
//@RequestMapping("/api/downloads")
//public class Aria2RpcController {
//
//    private final Aria2RpcService aria2RpcService;
//
//    public Aria2RpcController(Aria2RpcService aria2RpcService) {
//        this.aria2RpcService = aria2RpcService;
//    }
//
//    @PostMapping("/{gid}/cancel")
//    public ApiResponse<Void> cancelDownload(@PathVariable String gid) {
//        aria2RpcService.remove(gid);
//        return ApiResponse.success("Download cancelled successfully");
//    }
//
//    @GetMapping("/{gid}/status")
//    public ApiResponse<Aria2StatusParam> getDownloadStatus(@PathVariable String gid) {
//        return ApiResponse.success(aria2RpcService.tellStatus(gid));
//    }
//
//    @PostMapping("/{gid}/pause")
//    public ApiResponse<Void> pauseDownload(@PathVariable String gid) {
//        aria2RpcService.pause(gid);
//        return ApiResponse.success("Download paused successfully");
//    }
//
//    @PostMapping("/{gid}/resume")
//    public ApiResponse<Void> resumeDownload(@PathVariable String gid) {
//        aria2RpcService.unpause(gid);
//        return ApiResponse.success("Download resumed successfully");
//    }
//
//    @GetMapping("/queue/status")
//    public ApiResponse<Aria2GlobalStat> getQueueStatus() {
//        return ApiResponse.success(aria2RpcService.getGlobalStat());
//    }
//
//    @GetMapping("/active")
//    public ApiResponse<List<Aria2StatusParam>> getActiveDownloads() {
//        return ApiResponse.success(aria2RpcService.getActiveDownloads());
//    }
//
//    @GetMapping("/waiting")
//    public ApiResponse<List<Aria2StatusParam>> getWaitingDownloads() {
//        return ApiResponse.success(aria2RpcService.getWaitingDownloads(0, 100));
//    }
//}
