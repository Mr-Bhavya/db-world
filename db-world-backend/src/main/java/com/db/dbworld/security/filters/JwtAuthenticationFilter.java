package com.db.dbworld.security.filters;

import com.db.dbworld.audit.activity.service.UserActivityLogService;
import com.db.dbworld.core.context.UserContext;
import com.db.dbworld.infrastructure.logging.mdc.BodyMd5;
import com.db.dbworld.infrastructure.logging.mdc.MdcKeys;
import com.db.dbworld.payloads.RequestLogData;
import com.db.dbworld.security.auth.JwtService;
import com.db.dbworld.security.dto.CurrentUser;
import com.db.dbworld.utils.DbWorldUtils;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;

/**
 * Authenticates the request and emits the request-lifecycle log line.
 *
 * <p>Runs after {@code MdcContextFilter} (which has already seeded
 * {@code traceId}/{@code requestId}). Responsibilities here:
 * <ul>
 *   <li>Parse JWT and populate the {@link UserContext}.</li>
 *   <li>Cache request + response bodies so they can be MD5'd post-chain.</li>
 *   <li>Emit a structured request log line at INFO (WARN if slow).</li>
 *   <li>Fire-and-forget the activity log write to the async pool.</li>
 * </ul>
 *
 * <p>{@link ContentCachingResponseWrapper#copyBodyToResponse()} is critical —
 * without it the response body never flushes to the client.
 */
@Component
@Log4j2
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> EXCLUDED_URI_PATTERNS = List.of(
            "/favicon.ico", "/logo", "/js/bootstrap.min.js",
            "/static/", "/manifest.json", "/actuator/health", "/ws"
    );

    private static final List<String> TRACKED_METHODS = List.of("POST", "PUT", "DELETE", "PATCH");

    /** Requests slower than this get logged at WARN. 2s is a generous default. */
    private static final long SLOW_REQUEST_THRESHOLD_MS = 2_000L;

    /** Per-body cache limit. Matches the previous Spring default. */
    private static final int BODY_CACHE_LIMIT = 64 * 1024;

    private final DbWorldUtils dbWorldUtils;
    private final JwtService jwtService;
    private final UserContext userContext;
    private final UserActivityLogService activityLogService;

    /**
     * Use the configured Spring async pool so {@code MdcTaskDecorator} copies
     * the parent thread's MDC (traceId, requestId, md5) into the log thread.
     * Without this, {@code CompletableFuture.runAsync(...)} would default to
     * {@code ForkJoinPool.commonPool()} and the MDC would be lost — which was
     * showing up in logs as {@code [traceId=] [md5=]} on every request line.
     */
    private final Executor asyncExecutor;

    public JwtAuthenticationFilter(DbWorldUtils dbWorldUtils,
                                   JwtService jwtService,
                                   UserContext userContext,
                                   UserActivityLogService activityLogService,
                                   @Qualifier("taskExecutor") Executor asyncExecutor) {
        this.dbWorldUtils       = dbWorldUtils;
        this.jwtService         = jwtService;
        this.userContext        = userContext;
        this.activityLogService = activityLogService;
        this.asyncExecutor      = asyncExecutor;
    }

    @Override
    protected boolean shouldNotFilter(@Nonnull HttpServletRequest request) {
        return EXCLUDED_URI_PATTERNS.stream()
                .anyMatch(pattern -> request.getRequestURI().startsWith(pattern));
    }

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request,
                                    @Nonnull HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        ContentCachingRequestWrapper  cachedReq = new ContentCachingRequestWrapper(request, BODY_CACHE_LIMIT);
        ContentCachingResponseWrapper cachedRes = new ContentCachingResponseWrapper(response);

        long startNs = System.nanoTime();

        try {
            filterChain.doFilter(cachedReq, cachedRes);
        } finally {
            long durationMs = (System.nanoTime() - startNs) / 1_000_000L;

            // Compute the MD5 fingerprint while bodies are still in the cache.
            String md5 = BodyMd5.composite(
                    BodyMd5.hex(cachedReq.getContentAsByteArray()),
                    BodyMd5.hex(cachedRes.getContentAsByteArray()));
            if (!md5.isEmpty()) {
                ThreadContext.put(MdcKeys.MD5, md5);
            }

            // Write the cached response body out to the real response, otherwise
            // the client gets nothing back.
            try {
                cachedRes.copyBodyToResponse();
            } catch (IOException e) {
                log.warn("Failed to flush cached response body for {}: {}",
                        request.getRequestURI(), e.getMessage());
            }

            if (shouldTrackRequest(cachedReq)) {
                RequestLogData logData = extractRequestLogData(cachedReq, cachedRes, durationMs);

                // Capture the slow flag once on the calling thread — the async
                // task only sees logData and shouldn't repeat the calculation.
                boolean slow = durationMs >= SLOW_REQUEST_THRESHOLD_MS;

                CompletableFuture.runAsync(() -> logRequestDetails(logData, slow), asyncExecutor)
                        .exceptionally(t -> {
                            log.error("Async request-log write failed for {} {} (status={}, duration={}ms)",
                                    logData.getMethod(), logData.getUri(),
                                    logData.getStatus(), logData.getDuration(), t);
                            return null;
                        });
            }
        }
    }

    private boolean shouldTrackRequest(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod())
                || !request.getRequestURI().startsWith("/actuator");
    }

    private RequestLogData extractRequestLogData(HttpServletRequest request,
                                                 HttpServletResponse response,
                                                 long durationMs) {

        RequestLogData.RequestLogDataBuilder builder = RequestLogData.builder()
                .method(request.getMethod())
                .uri(request.getRequestURI())
                .query(request.getQueryString())
                .ip(dbWorldUtils.getClientIpAddress(request))
                .userAgent(request.getHeader("User-Agent"))
                .status(response.getStatus())
                .duration(durationMs)
                .requestId(ThreadContext.get(MdcKeys.REQUEST_ID))
                .requestBody(getRequestBody(request))
                .isRequest(true)
                .shouldPersist(shouldPersistToDatabase(request));

        enrichUser(builder, request);

        return builder.build();
    }

    private void logRequestDetails(RequestLogData logData, boolean slow) {
        // The async pool's MdcTaskDecorator copied the parent MDC over, but the
        // user/method/uri/status/duration slots are request-specific and only
        // make sense for THIS log line — set them just-in-time, then clear.
        ThreadContext.put(MdcKeys.IS_REQUEST, "true");
        ThreadContext.put(MdcKeys.USER,       safe(logData.getUserEmail()));
        ThreadContext.put(MdcKeys.METHOD,     safe(logData.getMethod()));
        ThreadContext.put(MdcKeys.URI,        safe(logData.getUri()));
        ThreadContext.put(MdcKeys.QUERY,      safe(logData.getQuery()));
        ThreadContext.put(MdcKeys.STATUS,     String.valueOf(logData.getStatus()));
        ThreadContext.put(MdcKeys.DURATION,   String.valueOf(logData.getDuration()));
        ThreadContext.put(MdcKeys.CLIENT_IP,  safe(logData.getIp()));

        // The MDC slots in the pattern already carry method/uri/status/duration/
        // user — repeating them in the message text was producing the same
        // values twice on every request line. Keep the message minimal; let
        // the pattern do the structured rendering.
        if (slow) {
            log.warn("slow");
        } else {
            log.info("ok");
        }

        if (logData.isShouldPersist()) {
            try {
                activityLogService.logActivity(logData);
            } catch (Exception e) {
                log.error("Failed to persist activity log for {} {}: {}",
                        logData.getMethod(), logData.getUri(), e.getMessage(), e);
            }
        }
    }

    private void enrichUser(RequestLogData.RequestLogDataBuilder builder, HttpServletRequest request) {
        String uri = request.getRequestURI();
        String token = request.getParameter("t");

        if (isStreamUri(uri) && token != null) {
            try {
                CurrentUser tokenUser = jwtService.parse(token);
                builder.userId(tokenUser.userId());
                builder.userEmail(tokenUser.email());
                return;
            } catch (Exception e) {
                // Token parse failure on a stream URI — fall through to anonymous.
                // DEBUG, not WARN: expired/bad tokens on streams are routine.
                log.debug("Stream-URI token parse failed for {}: {}", uri, e.getMessage());
            }
        }

        try {
            builder.userId(userContext.userId());
            builder.userEmail(userContext.email());
        } catch (Exception e) {
            log.debug("UserContext unavailable for {}: {}", uri, e.getMessage());
            builder.userEmail("anonymous");
        }
    }

    private boolean isStreamUri(String uri) {
        return uri.startsWith("/api/stream/watch")
                || uri.startsWith("/api/stream/download");
    }

    private String getRequestBody(HttpServletRequest request) {
        try {
            byte[] body = ((ContentCachingRequestWrapper) request).getContentAsByteArray();
            if (body.length == 0) return "";
            String encoding = request.getCharacterEncoding();
            return new String(body, encoding != null ? encoding : "UTF-8");
        } catch (Exception e) {
            log.debug("Failed to decode request body for {}: {}",
                    request.getRequestURI(), e.getMessage());
            return "";
        }
    }

    private boolean shouldPersistToDatabase(HttpServletRequest request) {
        return TRACKED_METHODS.contains(request.getMethod())
                || request.getRequestURI().startsWith("/api");
    }

    private static String safe(String v) {
        return v == null ? "" : v;
    }
}
