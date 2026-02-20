package com.hedgelab.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class PricingDemo {

    public static void main(String[] args) {

        FormulaComponent corn =
                new FormulaComponent(UUID.randomUUID(),
                        "Corn",
                        new BigDecimal("0.6"),
                        PricingType.INDEX,
                        "CORN");

        FormulaComponent energy =
                new FormulaComponent(UUID.randomUUID(),
                        "Energy",
                        new BigDecimal("0.4"),
                        PricingType.INDEX,
                        "ENERGY");

        FormulaPricing pricing =
                new FormulaPricing(UUID.randomUUID(),
                        "HFCS",
                        List.of(corn, energy));

        Map<String, BigDecimal> indexValues = Map.of(
                "CORN", new BigDecimal("5"),
                "ENERGY", new BigDecimal("10")
        );

        BigDecimal result =
                PricingCalculator.calculatePrice(pricing, indexValues);

        System.out.println("Calculated Price: " + result);
    }
}
