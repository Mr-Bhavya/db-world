package com.db.dbworld.core.push;

import com.db.dbworld.core.role.annotations.AdminAccess;
import com.db.dbworld.payloads.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin push utilities — app-agnostic (not IPO-specific). Lets an admin fire a test broadcast to
 * verify the whole chain (subscribe → send → device) without waiting for a real event, and read the
 * current push status (enabled flag, whether a real FCM transport is wired, and the broadcast topic).
 */
@RestController
@RequestMapping("/api/admin/push")
@RequiredArgsConstructor
@AdminAccess
public class PushAdminController {

    private final PushService pushService;

    /** GET /api/admin/push/status → {enabled, transportReady, topic} for diagnostics. */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> status() {
        return ApiResponse.success(Map.of(
                "enabled", pushService.isEnabled(),
                "transportReady", pushService.isTransportReady(),
                "topic", pushService.topic()));
    }

    /** POST /api/admin/push/test → broadcast a (customisable) test notification to every subscriber. */
    @PostMapping("/test")
    public ApiResponse<Void> test(@RequestBody(required = false) TestPushRequest req) {
        String title = req != null && notBlank(req.title()) ? req.title().trim() : "DB World test";
        String body = req != null && notBlank(req.body()) ? req.body().trim()
                : "If you can see this, push notifications are working. 🎉";
        Map<String, String> data = req != null && notBlank(req.link())
                ? Map.of("link", req.link().trim()) : Map.of();

        // Generic diagnostic push — no app-specific channel, so use the device default.
        pushService.broadcast(title, body, data, null);
        return ApiResponse.success("Test push sent to topic '" + pushService.topic() + "' (enabled="
                + pushService.isEnabled() + ", transportReady=" + pushService.isTransportReady()
                + "). It only arrives on devices that have enabled notifications.");
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    public record TestPushRequest(String title, String body, String link) {}
}
