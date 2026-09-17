package com.db.dbworld.app.tally.controller;

import com.db.dbworld.payloads.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Builds the module's success responses so the HTTP status and the envelope always agree.
 *
 * <p>{@link ApiResponse} carries an {@code httpStatusCode} <em>inside the body</em>, and
 * returning a bare {@code ApiResponse} from a handler lets Spring send 200 regardless of what
 * that field says. A created resource then answers "201" in the body over a 200 on the wire —
 * which is worse than simply always saying 200, because the two disagree and a client has to
 * pick one. Wrapping in {@link ResponseEntity} here sets both from a single argument.
 *
 * <p>Failures do not come through this class: they are {@code DbWorldException}s carrying their
 * own status, and {@code GlobalExceptionHandler} already renders them the same way.
 */
final class TallyResponses {

    private TallyResponses() {}

    /** 201, for a request that brought something into existence. */
    static <T> ResponseEntity<ApiResponse<T>> created(String message, T body) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(HttpStatus.CREATED, message, body));
    }

    /** 200 with a message, for a change the user should see confirmed. */
    static <T> ResponseEntity<ApiResponse<T>> ok(String message, T body) {
        return ResponseEntity.ok(ApiResponse.success(HttpStatus.OK, message, body));
    }

    /** 200 for a plain read, where a message would only be noise. */
    static <T> ResponseEntity<ApiResponse<T>> ok(T body) {
        return ResponseEntity.ok(ApiResponse.success(body));
    }
}
