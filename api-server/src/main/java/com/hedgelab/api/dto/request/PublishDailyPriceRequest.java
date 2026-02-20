package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PublishDailyPriceRequest(
    @NotBlank String indexCode,
    @NotNull LocalDate priceDate,
    @NotNull @Positive BigDecimal price,
    String priceType,
    String source
) {}
