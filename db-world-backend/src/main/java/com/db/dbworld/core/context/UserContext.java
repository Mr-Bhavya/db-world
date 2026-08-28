package com.db.dbworld.core.context;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.security.dto.CurrentUser;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Log4j2
@Component
public class UserContext {

    // ==============================
    // 🔐 PUBLIC METHODS
    // ==============================

    public CurrentUser currentUser() {
        Jwt jwt = getJwt();
        return new CurrentUser(
                convertToLong(jwt.getClaim("userId")),
                jwt.getClaimAsString("email"),
                jwt.getClaimAsString("role")
        );
    }

    /**
     * The signed-in user, or empty when the request carries no token.
     *
     * <p>{@link #currentUser()} throws for anonymous callers, which is right for endpoints that
     * require authentication. Endpoints that are public but richer when signed in — the home
     * dashboard summary — need to ask without being thrown at.
     */
    public Optional<CurrentUser> optionalUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            return Optional.empty();
        }

        Object userId = jwt.getClaim("userId");

        if (userId == null) {
            log.warn("Authenticated principal has no userId claim");
            return Optional.empty();
        }

        return Optional.of(new CurrentUser(
                convertToLong(userId),
                jwt.getClaimAsString("email"),
                jwt.getClaimAsString("role")
        ));
    }

    public Long userId() {
        Object claim = getJwt().getClaim("userId");

        if (claim == null) {
            log.warn("userId claim missing from JWT");
            throw new DbWorldException("userId not found in token");
        }

        return convertToLong(claim);
    }

    public String username() {
        return getJwt().getSubject();
    }

    public String email() {
        return getJwt().getClaimAsString("email");
    }

    public String role() {
        return getJwt().getClaimAsString("role");
    }

    // ==============================
    // 🔐 INTERNAL HELPERS
    // ==============================

    private Jwt getJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            log.debug("UserContext.getJwt called without authenticated principal");
            throw new DbWorldException("Unauthenticated request");
        }

        return jwt;
    }

    private Long convertToLong(Object value) {
        if (value instanceof Long l) return l;
        if (value instanceof Integer i) return i.longValue();
        if (value instanceof String s) return Long.parseLong(s);

        log.warn("Invalid userId claim type: {}", value.getClass().getName());
        throw new DbWorldException("Invalid userId type in token");
    }
}