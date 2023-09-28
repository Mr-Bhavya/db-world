package com.db.dbworld.payloads;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;
import org.springframework.http.HttpStatus;

@Getter
@Setter
@AllArgsConstructor
public class ApiResponse {
    private HttpStatus httpStatus;
    private int httpStatusCode;
    private boolean success;
    private String message;
    private Object data;


    public ApiResponse (HttpStatus httpStatus, boolean success, String message){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = message;
        this.data = null;
    }

    public ApiResponse (HttpStatus httpStatus, boolean success, Object data){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = null;
        this.data = data;
    }

    public ApiResponse (HttpStatus httpStatus, boolean success, String message, Object data){
        this.httpStatus = httpStatus;
        this.httpStatusCode = httpStatus.value();
        this.success = success;
        this.message = message;
        this.data = data;
    }

}
