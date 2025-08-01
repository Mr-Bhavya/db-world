package com.db.dbworld.controllers;

import com.db.dbworld.services.aria2.Aria2RpcService;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
        import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/downloads")
public class Aria2RpcController {

    private final Aria2RpcService aria2RpcService;

    public Aria2RpcController(Aria2RpcService aria2RpcService) {
        this.aria2RpcService = aria2RpcService;
    }

    @PostMapping("/{gid}/pause")
    public Mono<ResponseEntity<String>> pauseDownload(@PathVariable String gid) {
        return aria2RpcService.pause(gid)
                .map(result -> ResponseEntity.ok("Download paused successfully"))
                .onErrorResume(e -> Mono.just(
                        ResponseEntity.badRequest().body("Failed to pause download: " + e.getMessage())
                ));
    }

    @PostMapping("/{gid}/resume")
    public Mono<ResponseEntity<String>> resumeDownload(@PathVariable String gid) {
        return aria2RpcService.unpause(gid)
                .map(result -> ResponseEntity.ok("Download resumed successfully"))
                .onErrorResume(e -> Mono.just(
                        ResponseEntity.badRequest().body("Failed to resume download: " + e.getMessage())
                ));
    }

    @PostMapping("/{gid}/cancel")
    public Mono<ResponseEntity<String>> cancelDownload(@PathVariable String gid) {
        return aria2RpcService.remove(gid)
                .map(result -> ResponseEntity.ok("Download cancelled successfully"))
                .onErrorResume(e -> Mono.just(
                        ResponseEntity.badRequest().body("Failed to cancel download: " + e.getMessage())
                ));
    }

    @GetMapping("/{gid}/status")
    public Mono<ResponseEntity<ObjectNode>> getDownloadStatus(@PathVariable String gid) {
        return aria2RpcService.tellStatus(gid)
                .map(ResponseEntity::ok)
                .onErrorResume(e -> Mono.just(
                        ResponseEntity.badRequest().body(null)
                ));
    }
}