package com.hedgelab.domain;

import java.util.List;
import java.util.UUID;

public class FormulaPricing {

    private final UUID id;
    private final String productCode;
    private final List<FormulaComponent> components;

    public FormulaPricing(UUID id,
                          String productCode,
                          List<FormulaComponent> components) {
        this.id = id;
        this.productCode = productCode;
        this.components = components;
    }

    public UUID getId() { return id; }
    public String getProductCode() { return productCode; }
    public List<FormulaComponent> getComponents() { return components; }
}
