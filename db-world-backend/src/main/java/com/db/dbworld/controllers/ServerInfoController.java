//package com.db.dbworld.controllers;
//
//import com.db.dbworld.payloads.server.BaseServerInfo;
//import com.db.dbworld.payloads.server.HealthStatus;
//import com.db.dbworld.services.server.ServerInfoService;
//import io.swagger.v3.oas.annotations.Operation;
//import io.swagger.v3.oas.annotations.Parameter;
//import io.swagger.v3.oas.annotations.media.Content;
//import io.swagger.v3.oas.annotations.media.Schema;
//import io.swagger.v3.oas.annotations.responses.ApiResponse;
//import io.swagger.v3.oas.annotations.tags.Tag;
//import lombok.extern.log4j.Log4j2;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//
//import java.time.Instant;
//import java.time.LocalDateTime;
//import java.time.format.DateTimeFormatter;
//import java.util.HashMap;
//import java.util.Map;
//
///**
// * @deprecated Migrated to com.db.dbworld.app.system.info.controller.SystemInfoController.
// * REST Controller for system information endpoints.
// */
//@Deprecated(forRemoval = true)
//@Log4j2
//// @RestController — disabled; migrated to app.system.info.controller.SystemInfoController
//@RequestMapping("/api/server")
//@Tag(name = "System Information", description = "Endpoints for retrieving system monitoring data")
//public class ServerInfoController {
//
//    private final ServerInfoService serverInfoService;
//    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
//
//    public ServerInfoController(ServerInfoService serverInfoService) {
//        this.serverInfoService = serverInfoService;
//        log.info("ServerInfoController initialized");
//    }
//
//    @GetMapping("/info")
//    @Operation(
//            summary = "Get complete system information",
//            description = "Returns detailed system information including CPU, memory, disk, network, and processes.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "System information retrieved successfully",
//                            content = @Content(schema = @Schema(implementation = BaseServerInfo.class))),
//                    @ApiResponse(responseCode = "500", description = "Internal server error")
//            }
//    )
//    public ResponseEntity<?> getSystemInfo(
//            @Parameter(description = "Return as Map for backward compatibility", required = false)
//            @RequestParam(required = false, defaultValue = "false") boolean asMap) {
//
//        try {
//            log.debug("Request received for complete system information");
//            BaseServerInfo info = serverInfoService.getSystemInfo();
//
//            if (asMap) {
//                // Backward compatibility mode
//                Map<String, Object> map = serverInfoService.convertToMap(info);
//                map.put("timestamp", LocalDateTime.now().format(FORMATTER));
//                return ResponseEntity.ok(map);
//            }
//
//            return ResponseEntity.ok(info);
//        } catch (Exception e) {
//            log.error("Error retrieving system information", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve system information", e));
//        }
//    }
//
//    @GetMapping("/info/quick")
//    @Operation(
//            summary = "Get quick system information",
//            description = "Returns basic system metrics with faster response time (cached for 1 second).",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Quick system information retrieved successfully",
//                            content = @Content(schema = @Schema(implementation = BaseServerInfo.class)))
//            }
//    )
//    public ResponseEntity<?> getQuickSystemInfo(
//            @Parameter(description = "Return as Map for backward compatibility", required = false)
//            @RequestParam(required = false, defaultValue = "false") boolean asMap) {
//
//        try {
//            log.debug("Request received for quick system information");
//            BaseServerInfo info = serverInfoService.getQuickSystemInfo();
//
//            if (asMap) {
//                // Backward compatibility mode
//                Map<String, Object> map = serverInfoService.convertToMap(info);
//                map.put("timestamp", LocalDateTime.now().format(FORMATTER));
//                return ResponseEntity.ok(map);
//            }
//
//            return ResponseEntity.ok(info);
//        } catch (Exception e) {
//            log.error("Error retrieving quick system information", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve quick system information", e));
//        }
//    }
//
//    @GetMapping("/info/category/{category}")
//    @Operation(
//            summary = "Get specific system information category",
//            description = "Returns information for a specific system category (cpu, memory, disk, network, processes, services, temperature, hardware, performance, summary).",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Category information retrieved successfully"),
//                    @ApiResponse(responseCode = "400", description = "Invalid category requested")
//            }
//    )
//    public ResponseEntity<?> getSystemInfoCategory(
//            @Parameter(description = "Category name", example = "cpu", required = true)
//            @PathVariable String category) {
//
//        try {
//            log.debug("Request received for system category: {}", category);
//            Object info = serverInfoService.getSystemInfoCategory(category);
//
//            if (info instanceof Map && ((Map<?, ?>) info).containsKey("error")) {
//                return ResponseEntity.badRequest().body(info);
//            }
//
//            return ResponseEntity.ok(info);
//        } catch (Exception e) {
//            log.error("Error retrieving system category: {}", category, e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve system category: " + category, e));
//        }
//    }
//
//    @GetMapping("/health")
//    @Operation(
//            summary = "Get system health status",
//            description = "Returns the system health score (0-100) and overall status.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Health status retrieved successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> getSystemHealth() {
//        try {
//            int healthScore = serverInfoService.getHealthScore();
//            boolean isHealthy = serverInfoService.isSystemHealthy();
//            long uptime = serverInfoService.getSystemUptime();
//
//            HealthStatus healthStatus = serverInfoService.getQuickSystemInfo().getHealthStatus();
//
//            Map<String, Object> healthInfo = new HashMap<>();
//            healthInfo.put("healthScore", healthScore);
//            healthInfo.put("isHealthy", isHealthy);
//            healthInfo.put("status", getHealthStatus(healthScore));
//            healthInfo.put("uptimeMs", uptime);
//            healthInfo.put("uptimeFormatted", formatUptime(uptime));
//            healthInfo.put("timestamp", Instant.now().toEpochMilli());
//
//            // Include detailed health status if available
//            if (healthStatus != null) {
//                healthInfo.put("level", healthStatus.getLevel());
//                healthInfo.put("warnings", healthStatus.getWarnings());
//                healthInfo.put("issues", healthStatus.getIssues());
//                healthInfo.put("recommendations", healthStatus.getRecommendations());
//            }
//
//            return ResponseEntity.ok(healthInfo);
//        } catch (Exception e) {
//            log.error("Error retrieving system health", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve system health", e));
//        }
//    }
//
//    @GetMapping("/health/check")
//    @Operation(
//            summary = "Quick health check",
//            description = "Simple endpoint for health checks (returns HTTP 200 if system is healthy).",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "System is healthy"),
//                    @ApiResponse(responseCode = "503", description = "System is not healthy")
//            }
//    )
//    public ResponseEntity<Void> healthCheck() {
//        try {
//            boolean isHealthy = serverInfoService.isSystemHealthy();
//            if (isHealthy) {
//                return ResponseEntity.ok().build();
//            } else {
//                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
//            }
//        } catch (Exception e) {
//            log.error("Health check failed", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
//        }
//    }
//
//    @GetMapping("/health/detailed")
//    @Operation(
//            summary = "Get detailed health status",
//            description = "Returns detailed health information including warnings, issues, and recommendations.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Detailed health status retrieved successfully")
//            }
//    )
//    public ResponseEntity<HealthStatus> getDetailedHealth() {
//        try {
//            BaseServerInfo info = serverInfoService.getQuickSystemInfo();
//            HealthStatus healthStatus = info.getHealthStatus();
//
//            if (healthStatus == null) {
//                healthStatus = HealthStatus.builder()
//                        .score(0)
//                        .level(HealthStatus.HealthLevel.CRITICAL)
//                        .timestamp(Instant.now().toEpochMilli())
//                        .build();
//            }
//
//            return ResponseEntity.ok(healthStatus);
//        } catch (Exception e) {
//            log.error("Error retrieving detailed health", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
//        }
//    }
//
//    @PostMapping("/cache/refresh")
//    @Operation(
//            summary = "Refresh system information cache",
//            description = "Forces refresh of all cached system information.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Cache refreshed successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> refreshCache() {
//        try {
//            serverInfoService.refreshCache();
//            log.info("System information cache manually refreshed via API");
//
//            return ResponseEntity.ok(Map.of(
//                    "message", "System information cache refreshed successfully",
//                    "timestamp", Instant.now().toEpochMilli(),
//                    "status", "success"
//            ));
//        } catch (Exception e) {
//            log.error("Error refreshing cache", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to refresh cache", e));
//        }
//    }
//
//    @GetMapping("/metadata")
//    @Operation(
//            summary = "Get system metadata",
//            description = "Returns metadata about the system information service.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Metadata retrieved successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> getMetadata() {
//        Map<String, Object> metadata = new HashMap<>();
//        metadata.put("service", "System Information Service");
//        metadata.put("version", "2.0.0");
//        metadata.put("description", "Provides system monitoring and health information using POJO-based responses");
//        metadata.put("responseFormat", "JSON (POJO-based)");
//        metadata.put("timestamp", Instant.now().toEpochMilli());
//
//        Map<String, String> endpoints = new HashMap<>();
//        endpoints.put("GET /api/server/info", "Complete system information (POJO)");
//        endpoints.put("GET /api/server/info?asMap=true", "Complete system information (Map - backward compatible)");
//        endpoints.put("GET /api/server/info/quick", "Quick system metrics (POJO)");
//        endpoints.put("GET /api/server/info/quick?asMap=true", "Quick system metrics (Map - backward compatible)");
//        endpoints.put("GET /api/server/info/category/{category}", "Specific category information");
//        endpoints.put("GET /api/server/health", "System health status");
//        endpoints.put("GET /api/server/health/detailed", "Detailed health status (POJO)");
//        endpoints.put("GET /api/server/health/check", "Health check endpoint");
//        endpoints.put("POST /api/server/cache/refresh", "Refresh cache");
//        endpoints.put("GET /api/server/metadata", "This metadata endpoint");
//
//        metadata.put("endpoints", endpoints);
//
//        Map<String, String> cache = new HashMap<>();
//        cache.put("fullInfoTtl", "5 seconds");
//        cache.put("quickInfoTtl", "1 second");
//        cache.put("cacheType", "In-memory POJO cache");
//
//        metadata.put("cache", cache);
//
//        Map<String, String> supportedOS = new HashMap<>();
//        supportedOS.put("windows", "Windows Server/Desktop");
//        supportedOS.put("linux", "Linux distributions");
//        supportedOS.put("raspberryPi", "Raspberry Pi (special Linux)");
//        supportedOS.put("mac", "macOS");
//
//        metadata.put("supportedOperatingSystems", supportedOS);
//
//        Map<String, String> categories = new HashMap<>();
//        categories.put("cpu", "CPU information");
//        categories.put("memory", "Memory/RAM information");
//        categories.put("disk", "Disk/Storage information");
//        categories.put("network", "Network information");
//        categories.put("processes", "Running processes");
//        categories.put("services", "Running services");
//        categories.put("temperature", "Temperature sensors");
//        categories.put("hardware", "Hardware details");
//        categories.put("performance", "Performance metrics");
//        categories.put("summary", "System summary");
//
//        metadata.put("availableCategories", categories);
//
//        return ResponseEntity.ok(metadata);
//    }
//
//    @GetMapping("/types")
//    @Operation(
//            summary = "Get response type information",
//            description = "Returns information about the POJO types used in responses.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Type information retrieved successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> getTypeInfo() {
//        Map<String, Object> typeInfo = new HashMap<>();
//        typeInfo.put("timestamp", Instant.now().toEpochMilli());
//
//        Map<String, String> mainTypes = new HashMap<>();
//        mainTypes.put("BaseServerInfo", "Main response type containing all system information");
//        mainTypes.put("WindowsServerInfo", "Windows-specific extension of BaseServerInfo");
//        mainTypes.put("LinuxServerInfo", "Linux-specific extension of BaseServerInfo");
//        mainTypes.put("RaspberryPiServerInfo", "Raspberry Pi-specific extension of BaseServerInfo");
//        mainTypes.put("MacServerInfo", "macOS-specific extension of BaseServerInfo");
//
//        typeInfo.put("mainResponseTypes", mainTypes);
//
//        Map<String, String> componentTypes = new HashMap<>();
//        componentTypes.put("ServerInfo", "Basic server information");
//        componentTypes.put("CpuInfo", "CPU information");
//        componentTypes.put("MemoryInfo", "Memory information");
//        componentTypes.put("DiskInfo", "Disk information");
//        componentTypes.put("NetworkInfo", "Network information");
//        componentTypes.put("ProcessInfo", "Process information");
//        componentTypes.put("ServiceInfo", "Service information");
//        componentTypes.put("PerformanceMetrics", "Performance metrics");
//        componentTypes.put("HealthStatus", "Health status");
//        componentTypes.put("TemperatureInfo", "Temperature information");
//
//        typeInfo.put("componentTypes", componentTypes);
//
//        typeInfo.put("builderPattern", "All types use Lombok's @SuperBuilder for easy construction");
//        typeInfo.put("immutable", "Collections are mutable but individual fields are properly typed");
//
//        return ResponseEntity.ok(typeInfo);
//    }
//
//    /* ============================================
//       UTILITY METHODS
//       ============================================ */
//
//    private String getHealthStatus(int score) {
//        if (score >= 90) return "EXCELLENT";
//        if (score >= 80) return "GOOD";
//        if (score >= 70) return "FAIR";
//        if (score >= 60) return "POOR";
//        return "CRITICAL";
//    }
//
//    private String formatUptime(long uptimeMs) {
//        long seconds = uptimeMs / 1000;
//        long days = seconds / (24 * 3600);
//        long hours = (seconds % (24 * 3600)) / 3600;
//        long minutes = (seconds % 3600) / 60;
//        long secs = seconds % 60;
//
//        if (days > 0) {
//            return String.format("%d days, %02d:%02d:%02d", days, hours, minutes, secs);
//        } else {
//            return String.format("%02d:%02d:%02d", hours, minutes, secs);
//        }
//    }
//
//    private Map<String, Object> createErrorResponse(String message, Exception e) {
//        Map<String, Object> error = new HashMap<>();
//        error.put("error", message);
//        error.put("message", e.getMessage());
//        error.put("timestamp", Instant.now().toEpochMilli());
//        error.put("exception", e.getClass().getSimpleName());
//        return error;
//    }
//
//    /**
//     * Fallback endpoint for backward compatibility
//     */
//    @GetMapping("/info/map")
//    @Operation(
//            summary = "Get system information as Map (legacy)",
//            description = "Legacy endpoint that returns system information as Map for backward compatibility.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "System information retrieved successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> getSystemInfoAsMap() {
//        try {
//            log.debug("Request received for system information (legacy Map format)");
//            Map<String, Object> info = serverInfoService.getSystemInfoAsMap();
//            info.put("timestamp", LocalDateTime.now().format(FORMATTER));
//            info.put("legacyFormat", true);
//            return ResponseEntity.ok(info);
//        } catch (Exception e) {
//            log.error("Error retrieving system information", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve system information", e));
//        }
//    }
//
//    /**
//     * Fallback endpoint for backward compatibility
//     */
//    @GetMapping("/info/quick/map")
//    @Operation(
//            summary = "Get quick system information as Map (legacy)",
//            description = "Legacy endpoint that returns quick system information as Map for backward compatibility.",
//            responses = {
//                    @ApiResponse(responseCode = "200", description = "Quick system information retrieved successfully")
//            }
//    )
//    public ResponseEntity<Map<String, Object>> getQuickSystemInfoAsMap() {
//        try {
//            log.debug("Request received for quick system information (legacy Map format)");
//            Map<String, Object> info = serverInfoService.getQuickSystemInfoAsMap();
//            info.put("timestamp", LocalDateTime.now().format(FORMATTER));
//            info.put("legacyFormat", true);
//            return ResponseEntity.ok(info);
//        } catch (Exception e) {
//            log.error("Error retrieving quick system information", e);
//            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
//                    .body(createErrorResponse("Failed to retrieve quick system information", e));
//        }
//    }
//}