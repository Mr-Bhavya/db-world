package com.db.dbworld.exceptions;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class DbWorldException extends RuntimeException {

    private final HttpStatus httpStatus;
    private final Object data;

    /* ========================= CONSTRUCTORS ========================= */

    public DbWorldException(String message) {
        this(HttpStatus.INTERNAL_SERVER_ERROR, message, null, null);
    }

    public DbWorldException(String message, Throwable cause) {
        this(HttpStatus.INTERNAL_SERVER_ERROR, message, null, cause);
    }

    public DbWorldException(HttpStatus status, String message) {
        this(status, message, null, null);
    }

    public DbWorldException(HttpStatus status, String message, Object data) {
        this(status, message, data, null);
    }

    public DbWorldException(HttpStatus status, String message, Throwable cause) {
        this(status, message, null, cause);
    }

    public DbWorldException(HttpStatus status, String message, Object data, Throwable cause) {
        super(message, cause);
        this.httpStatus = status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
        this.data = data;
    }

}
