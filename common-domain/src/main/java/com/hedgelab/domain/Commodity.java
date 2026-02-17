package com.hedgelab.domain;

import java.util.UUID;

public class Commodity {

    private UUID id;
    private String name;
    private String unitOfMeasure;
    private String currency;
    private boolean hedgeable;

    public Commodity(UUID id, String name,
                     String unitOfMeasure,
                     String currency,
                     boolean hedgeable) {
        this.id = id;
        this.name = name;
        this.unitOfMeasure = unitOfMeasure;
        this.currency = currency;
        this.hedgeable = hedgeable;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getUnitOfMeasure() { return unitOfMeasure; }
    public String getCurrency() { return currency; }
    public boolean isHedgeable() { return hedgeable; }
}
