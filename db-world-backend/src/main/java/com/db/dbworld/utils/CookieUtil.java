package com.db.dbworld.utils;

import org.springframework.http.ResponseCookie;

import java.time.Duration;

public class CookieUtil {

    public static ResponseCookie addCookie(final String name, final String value, final Duration duration) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .path("/")
                .maxAge(duration)
                .build();
    }

    public static ResponseCookie removeCookie(final String name) {
        return ResponseCookie.from(name)
                .httpOnly(true)
                .path("/")
                .maxAge(0)
                .build();
    }

}
