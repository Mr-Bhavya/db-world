package com.db.dbworld.infrastructure.logging.mdc;

import com.db.dbworld.core.context.RequestContext;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.apache.logging.log4j.ThreadContext;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Seeds the {@link RequestContext} and Log4j2 {@code ThreadContext} (MDC) at
 * the very top of the filter chain so every log line emitted during the
 * request — even from filters or static-resource handlers that bypass auth —
 * carries a {@code traceId} and {@code requestId}.
 *
 * <p>Supports propagating an inbound {@code X-Trace-Id} / {@code X-Request-Id}
 * header (handy when a frontend or upstream gateway already generates IDs).
 * If absent, fresh UUIDs are minted.
 *
 * <p>Runs at {@link Ordered#HIGHEST_PRECEDENCE} so MDC is populated before
 * Spring Security and the JWT filter.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@Log4j2
public class MdcContextFilter extends OncePerRequestFilter {

    private static final String HEADER_TRACE_ID   = "X-Trace-Id";
    private static final String HEADER_REQUEST_ID = "X-Request-Id";

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request,
                                    @Nonnull HttpServletResponse response,
                                    @Nonnull FilterChain chain)
            throws ServletException, IOException {

        // Honor upstream-provided IDs when present; otherwise mint fresh ones.
        // This makes cross-service tracing trivial in front of a gateway.
        RequestContext.init();
        String traceHeader = request.getHeader(HEADER_TRACE_ID);
        if (StringUtils.hasText(traceHeader)) {
            RequestContext.setTraceId(traceHeader);
        }

        String traceId   = RequestContext.getTraceId();
        String requestId = RequestContext.getRequestId();

        ThreadContext.put(MdcKeys.TRACE_ID,   traceId);
        ThreadContext.put(MdcKeys.REQUEST_ID, requestId);

        // Echo the IDs back so the client (and downstream proxies) can correlate.
        response.setHeader(HEADER_TRACE_ID,   traceId);
        response.setHeader(HEADER_REQUEST_ID, requestId);

        try {
            chain.doFilter(request, response);
        } finally {
            ThreadContext.clearAll();
            RequestContext.clear();
        }
    }
}
