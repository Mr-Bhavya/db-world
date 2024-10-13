package com.db.dbworld.exceptions;

import com.db.dbworld.payloads.ApiResponse;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.convert.ConverterNotFoundException;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Log4j2
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ConverterNotFoundException.class)
    private ResponseEntity<ApiResponse> converterNotFoundExceptionHandler(ConverterNotFoundException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    private ResponseEntity<ApiResponse> methodArgumentNotValidExceptionHandler(MethodArgumentNotValidException ex) {
        List<String> errorList = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(fieldError ->
                errorList.add(fieldError.getField() + " " + fieldError.getDefaultMessage())
        );
        ApiResponse apiResponse = new ApiResponse(HttpStatus.BAD_REQUEST, false, errorList.toString());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    private ResponseEntity<ApiResponse> resourceNotFoundExceptionHandler(ResourceNotFoundException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.NOT_FOUND, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(ResourceDbUpdateException.class)
    private ResponseEntity<ApiResponse> ResourceDbUpdateExceptionHandler(ResourceDbUpdateException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(DuplicateResourceException.class)
    private ResponseEntity<ApiResponse> duplicateResourceExceptionHandler(DuplicateResourceException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.BAD_REQUEST, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(BadCredentialsException.class)
    private ResponseEntity<ApiResponse> badCredentialsExceptionHandler(BadCredentialsException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.UNAUTHORIZED, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

//    @ExceptionHandler(AuthenticationException.class)
//    private ResponseEntity<ApiResponse> authenticationExceptionHandler(AuthenticationException ex) {
//        ApiResponse apiResponse = new ApiResponse(HttpStatus.UNAUTHORIZED, false, ex.getMessage());
////        ApiResponse apiResponse = new ApiResponse(HttpStatus.UNAUTHORIZED, false, "You don't have valid token. Please login again !!");
//        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
//    }
//
//    @ExceptionHandler(AccessDeniedException.class)
//    public ResponseEntity<ApiResponse> accessDeniedExceptionHandler(AccessDeniedException ex) {
////        ApiResponse apiResponse = new ApiResponse(HttpStatus.FORBIDDEN, false, "You don't have required role to perform this action.");
//        ApiResponse apiResponse = new ApiResponse(HttpStatus.FORBIDDEN, false, ex.getMessage());
//        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
//    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiResponse> httpRequestMethodNotSupportedExceptionHandler(HttpRequestMethodNotSupportedException ex) {
        HttpHeaders httpHeaders = ex.getHeaders();
        log.error("{}. Supported methods for api({}): {}, requested method: {}", ex.getMessage(), httpHeaders.getOrigin(), Arrays.stream(ex.getSupportedMethods()).collect(Collectors.joining(",")),ex.getMethod());
        ApiResponse apiResponse = new ApiResponse(HttpStatus.METHOD_NOT_ALLOWED, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(TmdbApiException.class)
    ResponseEntity<ApiResponse> tmdbApiExceptionHandler(TmdbApiException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.valueOf(ex.getHttpStatusCode().value()), false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(DbWorldException.class)
    ResponseEntity<ApiResponse> dbWorldExceptionHandler(DbWorldException ex) {
        ApiResponse apiResponse = new ApiResponse(ex.getHttpStatus(), false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }

    @ExceptionHandler(NullPointerException.class)
    public ResponseEntity<ApiResponse> nullPointerExceptionHandler(NullPointerException ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, "Null Pointer Exception is occurred.");
        return new ResponseEntity<>(apiResponse, getJsonContentTypeHeader(), apiResponse.getHttpStatus());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiResponse> httpMessageNotReadableExceptionHandler(HttpMessageNotReadableException ex ) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.BAD_REQUEST, false, ex.getHttpInputMessage());
        return new ResponseEntity<>(apiResponse, getJsonContentTypeHeader(), apiResponse.getHttpStatus());
    }

    @ExceptionHandler(HttpMessageConversionException.class)
    public ResponseEntity<ApiResponse> httpMessageConversionExceptionHandler(HttpMessageConversionException ex ) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.BAD_REQUEST, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, getJsonContentTypeHeader(), apiResponse.getHttpStatus());
    }

    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<ApiResponse> dataAccessResourceFailureExceptionHandler(DuplicateResourceException ex){
        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, getJsonContentTypeHeader(), apiResponse.getHttpStatus());
    }

//    @ExceptionHandler(Exception.class)
//    public ResponseEntity<ApiResponse> exceptionHandler(Exception ex) {
//        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, ex.getMessage());
//        return new ResponseEntity<>(apiResponse, getJsonContentTypeHeader(), apiResponse.getHttpStatus());
//    }

    private HttpHeaders getJsonContentTypeHeader() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        return headers;
    }


}
