package com.hedgelab.v2.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends HedgeLabException {
    public ResourceNotFoundException(String resource, Object id) {
        super(resource + " not found: " + id, HttpStatus.NOT_FOUND);
    }
}
