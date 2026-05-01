package com.db.dbworld.core.exception;

public class ExtractException extends RuntimeException{
    private String message;

    public ExtractException (String message){
        this.message = message;
    }
}
