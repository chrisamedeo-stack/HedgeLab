package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RecordDeliveryRequest(
        @NotNull @Positive BigDecimal deliveredQuantity,
        LocalDate deliveryDate,
        String notes
) {}
