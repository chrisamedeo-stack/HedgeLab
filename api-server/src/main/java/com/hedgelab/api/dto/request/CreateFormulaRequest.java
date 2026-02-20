package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.PricingType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record CreateFormulaRequest(
    @NotBlank String formulaCode,
    @NotBlank String displayName,
    String description,
    @NotEmpty List<ComponentRequest> components
) {
    public record ComponentRequest(
        @NotNull Integer sequenceOrder,
        @NotBlank String componentLabel,
        @NotNull PricingType componentType,
        @NotNull BigDecimal weight,
        Long referenceIndexId,
        BigDecimal fixedValue,
        BigDecimal cap,
        BigDecimal floor
    ) {}
}
