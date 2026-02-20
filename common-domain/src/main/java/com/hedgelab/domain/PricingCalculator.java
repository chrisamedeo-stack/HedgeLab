package com.hedgelab.domain;

import java.math.BigDecimal;
import java.util.Map;

public class PricingCalculator {

    public static BigDecimal calculatePrice(
            FormulaPricing formula,
            Map<String, BigDecimal> indexValues) {

        BigDecimal total = BigDecimal.ZERO;

        for (FormulaComponent component : formula.getComponents()) {

            if (component.getPricingType() == PricingType.FIXED) {
                total = total.add(component.getWeight());
            } else {
                BigDecimal indexValue =
                        indexValues.get(component.getReferenceIndex());

                if (indexValue == null) {
                    throw new IllegalArgumentException(
                            "Missing index value for " +
                            component.getReferenceIndex());
                }

                total = total.add(
                        component.getWeight().multiply(indexValue)
                );
            }
        }

        return total;
    }
}
