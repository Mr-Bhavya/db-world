package com.db.dbworld.app.system.actions.controller;

import com.db.dbworld.api.response.ApiResponse;
import com.db.dbworld.app.system.actions.HostActionsService;
import com.db.dbworld.app.system.actions.dto.HostActionRequest;
import com.db.dbworld.app.system.actions.dto.HostActionSubmitted;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.core.role.annotations.AdminAccess;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class HostActionsControllerTest {

    private HostActionsService service;
    private UserContext userContext;
    private HostActionsController controller;

    @BeforeEach
    void setUp() {
        service = mock(HostActionsService.class);
        userContext = mock(UserContext.class);
        controller = new HostActionsController(service, userContext);
        when(service.submit(any(), any(), any(), any())).thenReturn(HostActionSubmitted.queued("id-1"));
    }

    private ApiResponse<HostActionSubmitted> submitReboot() {
        return controller.submit(new HostActionRequest("power-reboot", Map.of("when", "now"), "dbworldpi"));
    }

    @Test
    void submit_passesTheBodyThrough_andRecordsTheAdminsEmail() {
        when(userContext.email()).thenReturn("admin@example.com");

        ApiResponse<HostActionSubmitted> response = submitReboot();

        assertThat(response.getData().status()).isEqualTo("queued");
        verify(service).submit("power-reboot", Map.of("when", "now"), "dbworldpi", "admin@example.com");
    }

    @Test
    void submit_fallsBackToTheTokenSubject() {
        when(userContext.email()).thenReturn(null);
        when(userContext.username()).thenReturn("owner");

        submitReboot();

        verify(service).submit(any(), any(), any(), eq("owner"));
    }

    @Test
    void submit_fallsBackToAdmin_whenTheTokenSaysNothing() {
        when(userContext.email()).thenThrow(new DbWorldException("Unauthenticated request"));

        submitReboot();

        verify(service).submit(any(), any(), any(), eq("admin"));
    }

    /**
     * Two layers stand between the internet and a reboot: the filter chain (these paths are
     * not in {@code AppConstants.PUBLIC_APIS}) and {@code @AdminAccess} on every endpoint.
     * Losing the annotation in a refactor must break this test, not the server.
     */
    @Test
    void everyEndpoint_isAdminOnly() {
        List<String> unguarded = Arrays.stream(HostActionsController.class.getDeclaredMethods())
                .filter(m -> m.isAnnotationPresent(GetMapping.class) || m.isAnnotationPresent(PostMapping.class)
                        || m.isAnnotationPresent(RequestMapping.class))
                .filter(m -> !m.isAnnotationPresent(AdminAccess.class))
                .map(Method::getName)
                .toList();

        assertThat(HostActionsController.class.getDeclaredMethods())
                .filteredOn(m -> m.isAnnotationPresent(PostMapping.class))
                .isNotEmpty();
        assertThat(unguarded).isEmpty();
    }

    /**
     * The other layer: no public pattern may cover the action or power endpoints. It used to
     * be "/api/server/**", which let unauthenticated requests reach method security.
     */
    @Test
    void actionEndpoints_areNotPublicPaths() {
        var matcher = new org.springframework.util.AntPathMatcher();
        List<String> paths = List.of("/api/server/host-actions", "/api/server/host-actions/abc",
                "/api/server/host-power", "/api/server/host-health");
        for (String pattern : com.db.dbworld.config.AppConstants.PUBLIC_APIS) {
            for (String path : paths) {
                assertThat(matcher.match(pattern, path))
                        .as("PUBLIC_APIS entry %s must not expose %s", pattern, path)
                        .isFalse();
            }
        }
    }
}
