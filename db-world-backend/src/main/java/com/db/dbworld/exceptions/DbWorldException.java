package com.db.dbworld.exceptions;

import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpStatus;

@Getter
@Setter
public class DbWorldException extends RuntimeException {

    private String message;
    private HttpStatus httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
    private Object data;

    public DbWorldException(String message) {
        super(message);
        this.message = message;
    }

    public DbWorldException(String message, Object data) {
        super(message);
        this.message = message;
        this.data = data;
    }

    public DbWorldException(HttpStatus httpStatus, String message) {
        super(message);
        this.message = message;
        this.httpStatus = httpStatus;
    }

    public DbWorldException(HttpStatus httpStatus, String message, Object data) {
        super(message);
        this.message = message;
        this.httpStatus = httpStatus;
        this.data = data;
    }

}
