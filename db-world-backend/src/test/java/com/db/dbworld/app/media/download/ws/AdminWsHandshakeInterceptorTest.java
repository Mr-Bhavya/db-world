package com.db.dbworld.app.media.download.ws;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class AdminWsHandshakeInterceptorTest {

    JwtDecoder decoder = mock(JwtDecoder.class);
    AdminWsHandshakeInterceptor interceptor = new AdminWsHandshakeInterceptor(decoder);
    ServerHttpResponse response = mock(ServerHttpResponse.class);

    private ServerHttpRequest request(String query) {
        ServerHttpRequest req = mock(ServerHttpRequest.class);
        when(req.getURI()).thenReturn(URI.create("ws://host/ws/status" + query));
        return req;
    }

    private static Jwt jwt(String role) {
        return Jwt.withTokenValue("t").header("alg", "RS256")
                .claim("role", role).claim("email", "a@b.c")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
    }

    @Test
    void rejectsMissingToken() {
        assertThat(interceptor.beforeHandshake(request(""), response, null, new HashMap<>())).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        verifyNoInteractions(decoder);
    }

    @Test
    void rejectsInvalidToken() {
        when(decoder.decode(anyString())).thenThrow(new BadJwtException("bad"));
        assertThat(interceptor.beforeHandshake(request("?token=x"), response, null, new HashMap<>())).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void rejectsNonAdminRole() {
        when(decoder.decode("x")).thenReturn(jwt("USER"));
        assertThat(interceptor.beforeHandshake(request("?token=x"), response, null, new HashMap<>())).isFalse();
        verify(response).setStatusCode(HttpStatus.FORBIDDEN);
    }

    @Test
    void acceptsAdminAndOwner() {
        when(decoder.decode("a")).thenReturn(jwt("ADMIN"));
        when(decoder.decode("o")).thenReturn(jwt("OWNER"));
        Map<String, Object> attrs = new HashMap<>();
        assertThat(interceptor.beforeHandshake(request("?token=a"), response, null, attrs)).isTrue();
        assertThat(interceptor.beforeHandshake(request("?token=o"), response, null, new HashMap<>())).isTrue();
        assertThat(attrs).containsEntry("email", "a@b.c");
    }
}
