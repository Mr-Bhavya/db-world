package com.db.dbworld.app.media.ingestion.service;

import com.db.dbworld.app.media.ingestion.model.IngestionRequest;
import com.db.dbworld.app.media.ingestion.model.PlaylistItem;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Validates caller-supplied sources before a job is started.
 *
 * <ul>
 *   <li><b>localFilePath</b> must resolve (symlinks followed) to a regular file inside the configured
 *       stream or temp root, so a request can't make the pipeline read and move arbitrary server files.</li>
 *   <li><b>uri</b> may only use http/https/ftp(s)/magnet (or be scheme-less, e.g. a bare YouTube link),
 *       and a URL host must not resolve to loopback, link-local (cloud metadata), any-local or multicast
 *       addresses. LAN (site-local) hosts stay allowed for NAS/seedbox downloads.</li>
 * </ul>
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class IngestionInputGuard {

    private static final Set<String> NETWORK_SCHEMES = Set.of("http", "https", "ftp", "ftps", "sftp");

    private final AppProperties runtimeProperties;

    /** Validates every source in the request; normalises {@code localFilePath} to its real path. */
    public void validate(IngestionRequest request) {
        if (request == null) throw new IllegalArgumentException("Request body is required");
        validateUri(request.getUri());
        if (request.getUris() != null) request.getUris().forEach(this::validateUri);
        if (request.getPlaylistItems() != null) {
            for (PlaylistItem item : request.getPlaylistItems()) {
                if (item != null) validateUri(item.getUri());
            }
        }
        String local = request.getLocalFilePath();
        if (local != null && !local.isBlank()) {
            request.setLocalFilePath(requireAllowedLocalFile(local).toString());
        }
    }

    public void validateUri(String uri) {
        if (uri == null || uri.isBlank()) return;
        String trimmed = uri.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.startsWith("magnet:")) return;

        int schemeEnd = lower.indexOf("://");
        if (schemeEnd < 0) {
            int slash = lower.indexOf('/');
            String head = slash < 0 ? lower : lower.substring(0, slash);
            if (head.contains(":")) {
                throw new IllegalArgumentException("Unsupported link type: " + abbreviate(trimmed));
            }
            return;
        }
        String scheme = lower.substring(0, schemeEnd);
        if (!NETWORK_SCHEMES.contains(scheme)) {
            throw new IllegalArgumentException("Unsupported link scheme '" + scheme + "'");
        }

        String host;
        try {
            host = URI.create(trimmed.replace(" ", "%20")).getHost();
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid link: " + abbreviate(trimmed));
        }
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Link has no host: " + abbreviate(trimmed));
        }

        InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException e) {
            // Unresolvable now — let the downloader report it; nothing internal can be reached by it.
            return;
        }
        for (InetAddress address : addresses) {
            if (isBlockedAddress(address)) {
                log.warn("Rejected ingestion link to internal host {} ({})", host, address.getHostAddress());
                throw new IllegalArgumentException("Links to internal server addresses are not allowed: " + host);
            }
        }
    }

    static boolean isBlockedAddress(InetAddress address) {
        return address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isAnyLocalAddress()
                || address.isMulticastAddress();
    }

    /** Returns the real path of {@code raw} when it is an existing regular file under an allowed root. */
    public Path requireAllowedLocalFile(String raw) {
        Path real;
        try {
            real = Paths.get(raw.trim()).toRealPath();
        } catch (IOException | RuntimeException e) {
            throw new IllegalArgumentException("File not found on server: " + raw);
        }
        if (!Files.isRegularFile(real)) {
            throw new IllegalArgumentException("Not a file: " + raw);
        }
        for (Path root : allowedRoots()) {
            if (real.startsWith(root)) return real;
        }
        log.warn("Rejected localFilePath outside media roots: {}", raw);
        throw new SecurityException("File is outside the allowed media folders");
    }

    List<Path> allowedRoots() {
        List<Path> roots = new ArrayList<>();
        for (Path p : List.of(
                Objects.requireNonNullElse(runtimeProperties.getStreamPath(), Path.of("")),
                Objects.requireNonNullElse(runtimeProperties.getTempPath(), Path.of("")))) {
            if (p.toString().isEmpty()) continue;
            try {
                roots.add(p.toRealPath());
            } catch (IOException e) {
                roots.add(p.toAbsolutePath().normalize());
            }
        }
        return roots;
    }

    private static String abbreviate(String s) {
        return s.length() > 80 ? s.substring(0, 77) + "..." : s;
    }
}
