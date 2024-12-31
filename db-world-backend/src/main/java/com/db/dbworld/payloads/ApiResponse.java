package com.db.dbworld.payloads;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.http.HttpStatus;

import java.io.Serializable;
import java.util.Date;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ApiResponse <T> implements Serializable {
    private String timestamp = new Date(System.currentTimeMillis()).toString();
    private HttpStatus httpStatus;
    private int httpStatusCode;
    private boolean success;
    private String message;
    private T data = null;

    public ApiResponse (HttpStatus httpStatus, boolean success, String message){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = message;
    }

    public ApiResponse (HttpStatus httpStatus, boolean success, T data){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = null;
        this.data = data;
    }

    public ApiResponse (HttpStatus httpStatus, boolean success, String message, T data){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = message;
        this.data = data;
    }
}

