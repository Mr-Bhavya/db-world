package com.db.dbworld.payloads;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.io.Serializable;
import java.time.Instant;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> implements Serializable {

    private final String timestamp;
    private final int httpStatusCode;
    private final boolean success;
    private final String message;
    private final T data;

    /* =========================
       CONSTRUCTORS (PRIVATE)
       ========================= */

    private ApiResponse(int statusCode, boolean success, String message, T data) {
        this.timestamp = Instant.now().toString();
        this.httpStatusCode = statusCode;
        this.success = success;
        this.message = message;
        this.data = data;
    }

    private ApiResponse(HttpStatus status, boolean success, String message, T data) {
        this(status.value(), success, message, data);
    }

    /* =========================
       SUCCESS RESPONSES
       ========================= */

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(HttpStatus.OK, true, null, data);
    }

    public static <T> ApiResponse<T> success(String message, T data) {
        return new ApiResponse<>(HttpStatus.OK, true, message, data);
    }

    public static ApiResponse<Void> success(String message) {
        return new ApiResponse<>(HttpStatus.OK, true, message, null);
    }

    public static <T> ApiResponse<T> success(int status, String message, T data) {
        return new ApiResponse<>(status, true, message, data);
    }

    public static <T> ApiResponse<T> success(HttpStatus status, T data) {
        return new ApiResponse<>(status, true, null, data);
    }

    public static ApiResponse<Void> success(HttpStatus status, String message) {
        return new ApiResponse<>(status, true, message, null);
    }

    public static <T> ApiResponse<T> success(HttpStatus status, String message, T data) {
        return new ApiResponse<>(status, true, message, data);
    }

    /* =========================
       ERROR RESPONSES
       ========================= */

    public static ApiResponse<Void> error(int status, String message) {
        return new ApiResponse<>(status, false, message, null);
    }

    public static <T> ApiResponse<T> error(int status, String message, T data) {
        return new ApiResponse<>(status, false, message, data);
    }

    public static ApiResponse<Void> error(HttpStatus status, String message) {
        return new ApiResponse<>(status, false, message, null);
    }

    public static <T> ApiResponse<T> error(HttpStatus status, String message, T data) {
        return new ApiResponse<>(status, false, message, data);
    }
}
