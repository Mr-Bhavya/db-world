package com.db.dbworld.core.user.controller;

import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AnyRole;
import com.db.dbworld.core.user.dto.DeleteAccountRequest;
import com.db.dbworld.core.user.dto.UserDto;
import com.db.dbworld.core.user.service.AccountDeletionService;
import com.db.dbworld.core.user.service.UserService;
import com.db.dbworld.payloads.ApiResponse;
import com.db.dbworld.security.auth.AuthenticationService;
import com.db.dbworld.security.auth.SessionRevocationService;
import com.db.dbworld.security.entity.RefreshTokenEntity.RevokeReason;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import static com.db.dbworld.helpers.DbWorldRecords.AuthTokens.REFRESH_TOKEN_COOKIE_NAME;

/**
 * Self-service account management — what a user can do to their OWN account.
 *
 * <p>Mounted at {@code /api/account} rather than under {@code /api/user}, for two reasons: the
 * user-scoped paths there are all {@code /{userId}/...} and a literal {@code /me} segment sitting
 * beside them is easy to misread, and {@code /api/auth/**} is {@code permitAll} so nothing
 * requiring a signed-in caller can live there safely.
 */
@Log4j2
@RestController
@RequestMapping("/api/account")
@RequiredArgsConstructor
public class AccountController {

    private static final String REFRESH_TOKEN_HEADER = "X-Refresh-Token";

    private final UserService userService;
    private final UserContext userContext;
    private final AuthenticationService authenticationService;
    private final SessionRevocationService sessionRevocationService;

    // ==============================
    // Sessions
    // ==============================

    /** The caller's own sessions — one entry per device, not per token. */
    @AnyRole
    @GetMapping("/sessions")
    public ApiResponse<Map<String, Object>> mySessions(HttpServletRequest request) {
        Map<String, Object> payload =
                new LinkedHashMap<>(userService.getUserSessions(userContext.userId()));

        // Marking the caller's own row lets the UI label it "This device" and avoid offering a
        // revoke button that would sign them out of the page they are looking at.
        UUID currentFamily = authenticationService.resolveFamilyId(presentedRefreshToken(request));
        payload.put("currentSessionId", currentFamily != null ? currentFamily.toString() : null);
        return ApiResponse.success(payload);
    }

    /** Signs one of the caller's own devices out. */
    @AnyRole
    @DeleteMapping("/sessions/{familyId}")
    public ApiResponse<Void> revokeMySession(@PathVariable UUID familyId) {
        boolean revoked = sessionRevocationService.revokeFamily(
                userContext.userId(), familyId, RevokeReason.LOGOUT);
        return revoked
                ? ApiResponse.success("Signed out of that device")
                : ApiResponse.success("No active session matched");
    }

    /**
     * Signs the caller out everywhere.
     *
     * @param keepCurrent when true, spares the device making the request — the usual
     *                    "sign out my other devices" action after a suspected compromise.
     */
    @AnyRole
    @PostMapping("/sessions/revoke-all")
    public ApiResponse<Map<String, Object>> revokeMySessions(
            @RequestParam(defaultValue = "false") boolean keepCurrent,
            HttpServletRequest request) {

        UUID keepFamily = keepCurrent
                ? authenticationService.resolveFamilyId(presentedRefreshToken(request))
                : null;

        int revoked = sessionRevocationService.revokeAll(
                userContext.userId(), RevokeReason.LOGOUT_ALL, keepFamily);

        return ApiResponse.success("Signed out of " + revoked + " sessions",
                Map.of("revoked", revoked, "keptCurrent", keepFamily != null));
    }

    // ==============================
    // Deletion
    // ==============================

    /**
     * Deletes the caller's own account.
     *
     * <p>Requires re-authentication plus the account email typed back, because this erases a
     * document wallet holding government IDs and a password vault. The access token alone is
     * not enough proof for something irreversible.
     */
    @AnyRole
    @PostMapping("/delete")
    public ApiResponse<Map<String, Object>> deleteMyAccount(
            @Valid @RequestBody DeleteAccountRequest request) {

        Instant purgeAfter = userService.deleteOwnAccount(
                request.password(), request.confirmEmail());

        log.warn("Self-service deletion accepted for userId={} — purge at {}",
                userContext.userId(), purgeAfter);

        return ApiResponse.success(
                "Your account has been deleted. Sign in again before "
                        + purgeAfter + " to restore it.",
                Map.of("purgeAfter", purgeAfter));
    }

    /** Whether the caller's account is pending deletion, and until when it can be restored. */
    @AnyRole
    @GetMapping("/deletion-status")
    public ApiResponse<Map<String, Object>> deletionStatus() {
        UserDto user = userService.getUserProfile();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("pendingDeletion", user.getDeletedAt() != null);
        payload.put("deletedAt", user.getDeletedAt());
        payload.put("purgeAfter", user.getPurgeAfter());
        payload.put("graceDays", AccountDeletionService.GRACE_PERIOD.toDays());
        return ApiResponse.success(payload);
    }

    // ==============================
    // Internal
    // ==============================

    /** Web sends the httpOnly cookie; native sends the header from its secure storage. */
    private String presentedRefreshToken(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (var cookie : request.getCookies()) {
                if (REFRESH_TOKEN_COOKIE_NAME.equals(cookie.getName())
                        && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                    return cookie.getValue();
                }
            }
        }
        String header = request.getHeader(REFRESH_TOKEN_HEADER);
        return (header != null && !header.isBlank()) ? header : null;
    }
}
