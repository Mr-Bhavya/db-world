package com.db.dbworld.exceptions;

public class ExtractException extends RuntimeException{
    private String message;

    public ExtractException (String message){
        this.message = message;
    }
}
