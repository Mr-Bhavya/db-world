package com.db.dbworld.app.stream.service;

import com.db.dbworld.app.admin.config.registry.ConfigKeys;
import com.db.dbworld.app.admin.config.service.SettingsService;
import com.db.dbworld.app.stream.enums.StreamType;
import com.db.dbworld.config.AppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Produces the {@code &md5=…&expires=…} query suffix that nginx's
 * {@code ngx_http_secure_link_module} validates before serving a CDN file.
 *
 * <p>The hash is computed over the <b>decoded</b> request path (matching nginx's
 * {@code $uri}) plus the expiry and a shared secret, so it MUST stay byte-for-byte
 * in sync with the {@code secure_link_md5} directive in {@code dbworld.conf}:
 * <pre>
 *   secure_link          $arg_md5,$arg_expires;
 *   secure_link_md5      "$secure_link_expires $uri &lt;secret&gt;";
 * </pre>
 * i.e. {@code md5("<expires> <uri> <secret>")} base64url-encoded (no padding).
 *
 * <p>Expiry is per-intent: streaming URLs are short-lived (a watch session), download
 * URLs live long enough to be copy-pasted into an external downloader and to finish a
 * slow / resumed multi-connection transfer. Both TTLs are configurable
 * ({@code app.cdn.signing.stream-ttl-seconds} / {@code download-ttl-seconds}).
 *
 * <p>Signing is a no-op when {@code app.cdn.signing.enabled=false} or the secret is
 * blank — this is deliberate so the backend can be deployed (emitting signed URLs)
 * <i>before</i> nginx starts enforcing, avoiding an outage during rollout.
 */
@Log4j2
@Component
@RequiredArgsConstructor
public class CdnSigner {

    private final AppProperties props;
    private final SettingsService settings;
    private final AtomicBoolean warnedNoSecret = new AtomicBoolean(false);

    /**
     * Returns the signature query suffix ({@code &md5=…&expires=…}) to append to a CDN
     * URL, or an empty string when signing is disabled / unconfigured.
     *
     * @param uriPath the <b>decoded</b> request path exactly as nginx will see it in
     *                {@code $uri} (e.g. {@code /id/<uuid>} or {@code /path/Movies/My Movie.mkv})
     * @param type    ONLINE → stream TTL, DOWNLOAD → download TTL
     */
    public String signatureSuffix(String uriPath, StreamType type) {
        if (!settings.getBoolean(ConfigKeys.CDN_SIGNING_ENABLED)) return "";

        String secret = props.getCdnSigningSecret();   // secret stays in env
        if (!StringUtils.hasText(secret)) {
            if (warnedNoSecret.compareAndSet(false, true)) {
                log.warn("CDN signing is enabled but app.cdn.signing.secret is blank — "
                        + "serving UNSIGNED CDN URLs. Set the secret to activate signing.");
            }
            return "";
        }

        long ttl = (type == StreamType.DOWNLOAD)
                ? settings.getInt(ConfigKeys.CDN_SIGNING_DOWNLOAD_TTL_SECONDS)
                : settings.getInt(ConfigKeys.CDN_SIGNING_STREAM_TTL_SECONDS);
        long expires = Instant.now().getEpochSecond() + ttl;
        return "&md5=" + hash(expires, uriPath, secret) + "&expires=" + expires;
    }

    /**
     * Computes the base64url (no-padding) MD5 that nginx's {@code secure_link_md5}
     * expects. Package-private for unit testing against known vectors.
     */
    static String hash(long expires, String uriPath, String secret) {
        String raw = expires + " " + uriPath + " " + secret;
        try {
            byte[] digest = MessageDigest.getInstance("MD5").digest(raw.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            // MD5 is guaranteed present on every JVM; this cannot realistically happen.
            throw new IllegalStateException("MD5 algorithm unavailable", e);
        }
    }
}
