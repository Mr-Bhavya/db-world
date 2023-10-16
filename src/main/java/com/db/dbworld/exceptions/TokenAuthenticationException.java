package com.db.dbworld.exceptions;

import org.springframework.security.core.AuthenticationException;

public class TokenAuthenticationException extends AuthenticationException {
    private String message;
    public TokenAuthenticationException (String message) {
        super(message);
        this.message = message;
    }
    public TokenAuthenticationException(final String message, final Throwable cause){
        super(message);
        this.message = message;
    }

}
