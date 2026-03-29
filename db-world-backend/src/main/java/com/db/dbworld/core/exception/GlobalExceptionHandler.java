package com.db.dbworld.core.exception;

import com.db.dbworld.payloads.ApiResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.convert.ConverterNotFoundException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestCookieException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;

import java.io.IOException;
import java.util.stream.Collectors;

@Log4j2
@RestControllerAdvice
public class GlobalExceptionHandler {

    /* =========================
       CUSTOM APPLICATION EXCEPTIONS
       ========================= */

    @ExceptionHandler(DbWorldException.class)
    public ResponseEntity<ApiResponse<Void>> handleDbWorldException(DbWorldException ex) {
        log.warn("DbWorldException: {}", ex.getMessage());
        return build(ex.getHttpStatus(), ex.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        log.warn("Resource not found: {}", ex.getMessage());
        return build(HttpStatus.NOT_FOUND, ex.getMessage());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<ApiResponse<Void>> handleDuplicate(DuplicateResourceException ex) {
        log.warn("Duplicate resource: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(ResourceDbUpdateException.class)
    public ResponseEntity<ApiResponse<Void>> handleDbUpdate(ResourceDbUpdateException ex) {
        log.error("Database update error: {}", ex.getMessage());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, ex.getMessage());
    }

    /* =========================
       SECURITY
       ========================= */

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadCredentials(BadCredentialsException ex) {
        log.warn("Bad credentials attempt");
        return build(HttpStatus.UNAUTHORIZED, "Invalid username or password");
    }

    @ExceptionHandler(MissingRequestCookieException.class)
    public ResponseEntity<ApiResponse<Void>> handleMissingCookie(MissingRequestCookieException ex) {
        log.warn("Missing auth cookie: {}", ex.getCookieName());
        return build(HttpStatus.UNAUTHORIZED, "Authentication session expired — please log in again");
    }

    /* =========================
       VALIDATION & REQUEST ERRORS
       ========================= */

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {

        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(err -> err.getField() + " " + err.getDefaultMessage())
                .collect(Collectors.joining(", "));

        log.warn("Validation error: {}", message);
        return build(HttpStatus.BAD_REQUEST, message);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse<Void>> handleBadRequest(HttpMessageNotReadableException ex) {
        log.warn("Malformed request: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "Malformed request body");
    }

    @ExceptionHandler(HttpMessageConversionException.class)
    public ResponseEntity<ApiResponse<Void>> handleConversion(HttpMessageConversionException ex) {
        log.warn("Message conversion error: {}", ex.getMessage());
        return build(HttpStatus.BAD_REQUEST, "Invalid request payload");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex) {

        log.warn(
                "Method not allowed: {}. Supported: {}",
                ex.getMethod(),
                ex.getSupportedHttpMethods()
        );

        return build(HttpStatus.METHOD_NOT_ALLOWED, ex.getMessage());
    }

    @ExceptionHandler(ConverterNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleConverter(ConverterNotFoundException ex) {
        log.error("Converter not found: {}", ex.getMessage());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Response conversion failed");
    }

    /* =========================
       SSE (SERVER-SENT EVENTS) EXCEPTIONS
       These are expected during client disconnections
       ========================= */

    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public void handleAsyncRequestNotUsable(AsyncRequestNotUsableException ex) {
        // This is expected when clients disconnect from SSE
        // We don't return a response because the connection is already broken
        log.debug("Client disconnected from SSE (expected): {}", ex.getMessage());
    }

    @ExceptionHandler(IOException.class)
    public void handleIOException(IOException ex) {
        // Check if this is an SSE-related IOException (client disconnect)
        if (isSseDisconnect(ex)) {
            log.debug("Client disconnected from SSE (expected): {}", ex.getMessage());
        } else {
            log.error("IO Exception", ex);
        }
    }

    /* =========================
       FILE MANAGER
       ========================= */

    @ExceptionHandler(SecurityException.class)
    public ResponseEntity<ApiResponse<Void>> handleSecurity(SecurityException ex) {
        log.warn("Security exception: {}", ex.getMessage());
        return build(HttpStatus.FORBIDDEN, "Access denied: " + ex.getMessage());
    }

    @ExceptionHandler(java.nio.file.NoSuchFileException.class)
    public ResponseEntity<ApiResponse<Void>> handleNoSuchFile(java.nio.file.NoSuchFileException ex) {
        log.warn("File not found: {}", ex.getFile());
        return build(HttpStatus.NOT_FOUND, "File not found: " + ex.getFile());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalState(IllegalStateException ex) {
        log.warn("Illegal state: {}", ex.getMessage());
        return build(HttpStatus.CONFLICT, ex.getMessage());
    }

    /* =========================
       DATABASE
       ========================= */

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiResponse<Void>> handleDatabase(DataAccessException ex) {
        log.error("Database error: {}", ex.getMessage());
        log.debug("Stack trace: ", ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "Database operation failed");
    }

    /* =========================
       LAST RESORT - UNHANDLED EXCEPTIONS
       Special handling for SSE endpoints
       ========================= */

    @ExceptionHandler(Exception.class)
    public Object handleUnexpected(Exception ex) {

        // Check if this is an SSE-related exception
        if (isSseException(ex)) {
            log.debug("SSE connection error (expected during client disconnect): {}", ex.getMessage());
            // Return null to let the connection die naturally
            return null;
        }

        // For regular REST endpoints, return error response
        log.error("Unhandled exception", ex);
        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Unexpected error occurred. Please contact support."
        );
    }

    /* =========================
       HELPER METHODS
       ========================= */

    private ResponseEntity<ApiResponse<Void>> build(HttpStatus status, String message) {
        return ResponseEntity
                .status(status)
                .body(ApiResponse.error(status.value(), message));
    }

    private boolean isSseException(Exception ex) {
        // Check for SSE-specific exceptions
        if (ex instanceof AsyncRequestNotUsableException) {
            return true;
        }

        if (ex instanceof IOException) {
            return isSseDisconnect((IOException) ex);
        }

        // Check message patterns
        String message = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        return message.contains("response not usable") ||
                message.contains("client disconnected") ||
                message.contains("broken pipe") ||
                message.contains("connection reset") ||
                message.contains("sse") ||
                message.contains("event stream");
    }

    private boolean isSseDisconnect(IOException ex) {
        String message = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
        return message.contains("broken pipe") ||
                message.contains("connection reset") ||
                message.contains("client disconnected") ||
                message.contains("stream closed");
    }
}