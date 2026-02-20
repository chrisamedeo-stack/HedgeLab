package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AmendTradeRequest(
        @Positive BigDecimal quantity,
        @Positive BigDecimal fixedPrice,
        LocalDate startDate,
        LocalDate endDate,
        @NotBlank String amendmentReason
) {}
