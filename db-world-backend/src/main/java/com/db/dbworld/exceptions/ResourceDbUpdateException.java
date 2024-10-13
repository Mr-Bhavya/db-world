package com.db.dbworld.exceptions;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ResourceDbUpdateException extends RuntimeException {

    private String resourceName;
    private String methodName;

    public ResourceDbUpdateException(String resourceName, String methodName) {
        super(String.format("%s is not updating in db in method %s", resourceName, methodName));
        this.resourceName = resourceName;
        this.methodName = methodName;
    }
}
