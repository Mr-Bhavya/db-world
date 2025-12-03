package com.db.dbworld.services.aria2.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// Generic response wrapper for different result types
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Aria2Response<T> {
    private boolean success;
    private String message;
    private T data;
    private Aria2RpcError error;

    public static <T> Aria2Response<T> success(T data) {
        return new Aria2Response<>(true, "Operation completed successfully", data, null);
    }

    public static <T> Aria2Response<T> success(T data, String message) {
        return new Aria2Response<>(true, message, data, null);
    }

    public static <T> Aria2Response<T> error(String message) {
        return new Aria2Response<>(false, message, null, new Aria2RpcError(-1, message, null));
    }

    public static <T> Aria2Response<T> error(Aria2RpcError error) {
        return new Aria2Response<>(false, error.getMessage(), null, error);
    }
}
