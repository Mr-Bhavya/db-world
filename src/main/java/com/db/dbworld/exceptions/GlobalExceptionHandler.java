package com.db.dbworld.exceptions;

import com.db.dbworld.payloads.ApiResponse;
import org.springframework.core.convert.ConverterNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;

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

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse> exceptionHandler(Exception ex) {
        ApiResponse apiResponse = new ApiResponse(HttpStatus.INTERNAL_SERVER_ERROR, false, ex.getMessage());
        return new ResponseEntity<>(apiResponse, apiResponse.getHttpStatus());
    }


}
