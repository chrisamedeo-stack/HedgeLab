package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RecordPaymentRequest(
    @NotNull LocalDate paymentDate,
    @NotNull @Positive BigDecimal amountUsd,
    @NotNull @Size(min = 3, max = 3) String currency,
    BigDecimal fxRateToUsd,
    @Size(max = 50) String paymentReference,
    @Size(max = 20) String paymentMethod
) {}
