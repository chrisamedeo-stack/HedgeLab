package com.hedgelab.api.exception;

import org.springframework.http.HttpStatus;

public class MarketDataNotFoundException extends HedgeLabException {
    public MarketDataNotFoundException(String indexCode, Object date) {
        super("No market data for index " + indexCode + " on " + date, HttpStatus.NOT_FOUND);
    }
}
