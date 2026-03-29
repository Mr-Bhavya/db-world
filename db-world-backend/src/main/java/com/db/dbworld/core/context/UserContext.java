package com.db.dbworld.core.context;

import com.db.dbworld.core.exception.DbWorldException;
import com.db.dbworld.security.dto.CurrentUser;
import lombok.extern.log4j.Log4j2;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

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

    public Long userId() {
        Object claim = getJwt().getClaim("userId");

        if (claim == null) {
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
            throw new DbWorldException("Unauthenticated request");
        }

        return jwt;
    }

    private Long convertToLong(Object value) {
        if (value instanceof Long l) return l;
        if (value instanceof Integer i) return i.longValue();
        if (value instanceof String s) return Long.parseLong(s);

        throw new DbWorldException("Invalid userId type in token");
    }
}