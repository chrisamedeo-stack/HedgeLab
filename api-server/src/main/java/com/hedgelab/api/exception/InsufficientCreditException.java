package com.hedgelab.api.exception;

import org.springframework.http.HttpStatus;

public class InsufficientCreditException extends HedgeLabException {
    public InsufficientCreditException(String counterpartyCode, String detail) {
        super("Credit limit exceeded for counterparty " + counterpartyCode + ": " + detail, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
