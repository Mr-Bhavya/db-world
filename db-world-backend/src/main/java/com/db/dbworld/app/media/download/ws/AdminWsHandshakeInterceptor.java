package com.db.dbworld.app.media.download.ws;

import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.Set;

/**
 * Gates admin WebSocket endpoints (e.g. {@code /ws/status}) behind a valid OWNER/ADMIN access token.
 *
 * <p>Browsers cannot set an {@code Authorization} header on a WebSocket upgrade, so the token is
 * read from the {@code token} query parameter. It is checked with the application's
 * {@link JwtDecoder}, which also enforces expiry and token-version revocation.
 */
@Component
@Log4j2
public class AdminWsHandshakeInterceptor implements HandshakeInterceptor {

    static final String TOKEN_PARAM = "token";
    private static final Set<String> ALLOWED_ROLES = Set.of("OWNER", "ADMIN");

    private final JwtDecoder jwtDecoder;

    public AdminWsHandshakeInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        String token = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst(TOKEN_PARAM);

        if (token == null || token.isBlank()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        try {
            Jwt jwt = jwtDecoder.decode(token);
            String role = jwt.getClaimAsString("role");
            if (role == null || !ALLOWED_ROLES.contains(role)) {
                response.setStatusCode(HttpStatus.FORBIDDEN);
                return false;
            }
            attributes.put("email", jwt.getClaimAsString("email"));
            return true;
        } catch (JwtException e) {
            log.debug("WS handshake rejected: {}", e.getMessage());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // no-op
    }
}
