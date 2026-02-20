package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.PricingType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PricingResultResponse(
    Long tradeId,
    String tradeReference,
    LocalDate asOfDate,
    PricingType pricingType,
    BigDecimal calculatedUnitPrice,
    BigDecimal spread,
    BigDecimal totalPrice,
    BigDecimal quantity,
    BigDecimal notionalUsd,
    String currency,
    String methodology
) {}
