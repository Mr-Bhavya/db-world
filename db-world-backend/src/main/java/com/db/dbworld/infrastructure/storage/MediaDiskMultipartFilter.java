package com.db.dbworld.infrastructure.storage;

import com.db.dbworld.api.response.ApiResponse;
import com.google.gson.Gson;
import jakarta.annotation.Nonnull;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.security.autoconfigure.web.servlet.SecurityFilterProperties;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Refuses multipart requests while the media disk is missing, before the servlet container
 * spools their parts to disk.
 *
 * <p>{@code spring.servlet.multipart.location} is {@code ${app.paths.temp}}, which is on the
 * media disk, and {@code file-size-threshold: 0} writes every part there. The container does
 * that while resolving the request, before any controller or service runs, so a check in the
 * service would come after the bytes were already on the SD card under the empty mount point
 * (or, with no temp folder there, fail with an unhelpful "temporary upload location is not
 * valid"). The answer is the guard's own message, as the usual {@link ApiResponse} error.
 *
 * <p>Ordered just after Spring Security, so the request is authenticated and the response
 * carries the CORS headers the SPA needs to read it, and before anything that would read
 * request parameters (which parses the parts). Does nothing when the multipart location is
 * outside the media tree or the guard is off.
 */
@Log4j2
@Component
@Order(SecurityFilterProperties.DEFAULT_FILTER_ORDER + 1)
public class MediaDiskMultipartFilter extends OncePerRequestFilter {

    private static final Gson GSON = new Gson();

    private final MediaDiskGuard mediaDiskGuard;
    private final Path           multipartLocation;

    public MediaDiskMultipartFilter(MediaDiskGuard mediaDiskGuard,
                                    @Value("${spring.servlet.multipart.location:}") String multipartLocation) {
        this.mediaDiskGuard    = mediaDiskGuard;
        this.multipartLocation = StringUtils.hasText(multipartLocation) ? Path.of(multipartLocation) : null;
    }

    @Override
    protected boolean shouldNotFilter(@Nonnull HttpServletRequest request) {
        return !StringUtils.startsWithIgnoreCase(request.getContentType(), "multipart/")
                || !mediaDiskGuard.isInMediaTree(multipartLocation);
    }

    @Override
    protected void doFilterInternal(@Nonnull HttpServletRequest request,
                                    @Nonnull HttpServletResponse response,
                                    @Nonnull FilterChain chain) throws ServletException, IOException {
        if (mediaDiskGuard.isMounted()) {
            chain.doFilter(request, response);
            return;
        }
        String message = mediaDiskGuard.notMountedMessage("Upload");
        log.warn("Refused {} {}: {}", request.getMethod(), request.getRequestURI(), message);
        HttpStatus status = HttpStatus.SERVICE_UNAVAILABLE;
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(GSON.toJson(ApiResponse.error(status, message)));
    }
}
