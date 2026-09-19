package com.db.dbworld.core.exception;

import com.db.dbworld.api.response.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The handler is a plain object with no collaborators, so these are straight unit tests.
 *
 * <p>Covers the {@link ResponseStatusException} safety net specifically. It exists because this
 * advice is consulted before Spring's own {@code ResponseStatusExceptionResolver}, so before the
 * handler was added the {@code Exception} catch-all matched first and turned every one of these
 * into a 500 reading "Unexpected error occurred" — losing both the status and the message.
 */
class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void aResponseStatusExceptionKeepsItsStatusAndReason() {
        var response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pass either ?city= or ?lat=&lon="));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(body(response).getHttpStatusCode()).isEqualTo(400);
        assertThat(body(response).getMessage()).isEqualTo("Pass either ?city= or ?lat=&lon=");
        assertThat(body(response).isSuccess()).isFalse();
    }

    @Test
    void aMissingReasonFallsBackToTheStatusPhraseRatherThanNull() {
        var response = handler.handleResponseStatus(new ResponseStatusException(HttpStatus.NOT_FOUND));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(body(response).getMessage()).isEqualTo("Not Found");
    }

    @Test
    void aBlankReasonAlsoFallsBackToTheStatusPhrase() {
        var response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatus.BAD_GATEWAY, "   "));

        assertThat(body(response).getMessage()).isEqualTo("Bad Gateway");
    }

    /**
     * A non-standard code must not blow up the handler: {@code HttpStatus.valueOf} would throw here,
     * and an exception thrown from inside a handler lands back on the catch-all — the exact 500 this
     * handler exists to prevent.
     */
    @Test
    void aNonStandardStatusCodeDegradesTo500InsteadOfThrowing() {
        var response = handler.handleResponseStatus(
                new ResponseStatusException(HttpStatusCode.valueOf(599), "upstream went sideways"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(body(response).getMessage()).isEqualTo("upstream went sideways");
    }

    /** A {@link DbWorldException} is answered with the status it carries, not a blanket 500. */
    @Test
    void aDbWorldExceptionKeepsItsOwnStatus() {
        var response = handler.handleDbWorldException(
                new DbWorldException(HttpStatus.SERVICE_UNAVAILABLE, "Weather is not configured on the server"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(body(response).getMessage()).isEqualTo("Weather is not configured on the server");
    }

    private static ApiResponse<Void> body(ResponseEntity<ApiResponse<Void>> response) {
        assertThat(response.getBody()).isNotNull();
        return response.getBody();
    }
}
