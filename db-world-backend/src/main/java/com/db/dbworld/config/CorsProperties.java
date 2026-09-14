package com.db.dbworld.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Browser origins allowed to make CREDENTIALED cross-origin calls — {@code app.cors} in
 * application.yml, with the dev-machine and LAN origins added by the {@code local} profile.
 *
 * <p>This is the whole access-control boundary for the browser: an origin named here can read
 * any response the signed-in user can, because {@code allowCredentials} is on. The production
 * list therefore holds only real DB World hosts, plus {@code https://localhost} — which is the
 * Capacitor WebView's own origin, not a developer machine, and without it the packaged Android
 * app is cross-origin to its own API.
 *
 * <p>Bound as {@code @ConfigurationProperties} rather than read with {@code @Value}, and that is
 * not a style choice: a YAML sequence is flattened into INDEXED properties
 * ({@code ...allowed-origin-patterns[0]}, {@code [1]}, …), so no property with the bare list name
 * ever exists and {@code @Value("${app.cors.allowed-origin-patterns}")} fails outright with
 * "Could not resolve placeholder". {@code @Value} can only produce a List from a comma-separated
 * STRING. Binding is the mechanism that understands sequences.
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOriginPatterns) {

    /**
     * @throws IllegalStateException when the list is missing or empty. Deliberately fatal at
     * startup rather than defaulted: an empty allow-list silently blocks every browser client,
     * and a permissive fallback would quietly undo the reason this moved into configuration in
     * the first place.
     */
    public List<String> allowedOriginPatterns() {
        if (allowedOriginPatterns == null || allowedOriginPatterns.isEmpty()) {
            throw new IllegalStateException(
                    "app.cors.allowed-origin-patterns is empty — every browser origin would be refused. "
                            + "Set it in application.yml (production hosts) or application-local.yml (dev).");
        }
        return allowedOriginPatterns;
    }
}
