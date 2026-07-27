package com.db.dbworld.core.push;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.core.context.UserContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * Device push-token registration for the signed-in user. The web/Android clients call
 * {@code /register} once they have an FCM token (and permission), and {@code /unregister} on
 * logout / permission revocation. Secured like the other {@code /api/**} user endpoints (see
 * {@code UserNotificationController}) — the caller must be authenticated.
 */
@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushService pushService;
    private final UserContext userContext;

    /** POST /api/push/register — register this device + subscribe it to the broadcast topic. */
    @PostMapping("/register")
    public ApiResponse<Void> register(@Valid @RequestBody RegisterRequest req) {
        pushService.register(userContext.userId(), req.token(), req.platform());
        return ApiResponse.success("Registered for push");
    }

    /** POST /api/push/unregister — forget this device token. */
    @PostMapping("/unregister")
    public ApiResponse<Void> unregister(@Valid @RequestBody UnregisterRequest req) {
        pushService.unregister(req.token());
        return ApiResponse.success("Unregistered from push");
    }

    public record RegisterRequest(@NotBlank String token, String platform) {}

    public record UnregisterRequest(@NotBlank String token) {}
}
