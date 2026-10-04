package com.db.dbworld.app.system.actions.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.system.actions.HostActionsService;
import com.db.dbworld.app.system.actions.dto.HostActionRequest;
import com.db.dbworld.app.system.actions.dto.HostActionResult;
import com.db.dbworld.app.system.actions.dto.HostActionSubmitted;
import com.db.dbworld.app.system.actions.dto.HostActionsList;
import com.db.dbworld.app.system.actions.dto.HostPowerState;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.role.annotations.AdminAccess;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Server actions on the System Info page: health check, backup, cleanup, service restarts and
 * power, all carried out by the host's root action broker rather than by this app.
 *
 * <p>Errors come back through {@code GlobalExceptionHandler}: 400 with a readable message for a
 * request that breaks a rule, 409 while another power request is queued, 503 where this server
 * has no broker. The read endpoints never fail for a missing broker; they say "unavailable".
 */
@RestController
@RequestMapping("/api/server")
public class HostActionsController {

    private final HostActionsService service;
    private final UserContext userContext;

    public HostActionsController(HostActionsService service, UserContext userContext) {
        this.service = service;
        this.userContext = userContext;
    }

    /** Queues an action for the host. Answers at once with the id; the host runs it a moment later. */
    @AdminAccess
    @PostMapping("/host-actions")
    public ApiResponse<HostActionSubmitted> submit(@RequestBody HostActionRequest body) {
        HostActionSubmitted queued = service.submit(body.action(), body.args(), body.confirm(), requestedBy());
        return ApiResponse.success("Queued", queued);
    }

    /** Queued requests and recent results, newest first, without output; plus availability and the host name. */
    @AdminAccess
    @GetMapping("/host-actions")
    public ApiResponse<HostActionsList> list() {
        return ApiResponse.success(service.list());
    }

    /** One action, with its output and any data (the cleanup preview). */
    @AdminAccess
    @GetMapping("/host-actions/{id}")
    public ApiResponse<HostActionResult> get(@PathVariable String id) {
        return ApiResponse.success(service.get(id));
    }

    /** The host's power.json: a scheduled reboot or shutdown and the wake alarm. Always 200. */
    @AdminAccess
    @GetMapping("/host-power")
    public ApiResponse<HostPowerState> power() {
        return ApiResponse.success(service.power());
    }

    /**
     * Who asked, for the request file, the audit log line and the push. The email is what admins
     * recognise each other by; the token subject is the fallback for an account without one.
     */
    private String requestedBy() {
        try {
            String email = userContext.email();
            if (email != null && !email.isBlank()) return email;
            String subject = userContext.username();
            if (subject != null && !subject.isBlank()) return subject;
        } catch (RuntimeException e) {
            // @AdminAccess has already let the caller in; a token without these claims is still an admin.
        }
        return "admin";
    }
}
