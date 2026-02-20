package com.hedgelab.domain;

import java.math.BigDecimal;
import java.util.UUID;

public class FormulaComponent {

    private final UUID id;
    private final String name;
    private final BigDecimal weight;
    private final PricingType pricingType;
    private final String referenceIndex;

    public FormulaComponent(UUID id,
                            String name,
                            BigDecimal weight,
                            PricingType pricingType,
                            String referenceIndex) {
        this.id = id;
        this.name = name;
        this.weight = weight;
        this.pricingType = pricingType;
        this.referenceIndex = referenceIndex;
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public BigDecimal getWeight() { return weight; }
    public PricingType getPricingType() { return pricingType; }
    public String getReferenceIndex() { return referenceIndex; }
}
