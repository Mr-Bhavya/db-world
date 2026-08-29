package com.db.dbworld.security.dto;

import com.db.dbworld.security.enums.ClientPlatform;

/**
 * What we know about the client asking for a session, captured at the controller edge so the
 * service layer never has to reach for the {@code HttpServletRequest}.
 */
public record SessionContext(ClientPlatform platform, String userAgent, String ipAddress) {

    /** Fallback for internal callers that mint a session outside a request (jobs, tests). */
    public static SessionContext unknown() {
        return new SessionContext(ClientPlatform.WEB, "unknown", null);
    }
}
