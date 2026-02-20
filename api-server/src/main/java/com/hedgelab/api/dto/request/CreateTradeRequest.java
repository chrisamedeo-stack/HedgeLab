package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.PricingType;
import com.hedgelab.api.entity.TradeType;
import com.hedgelab.api.entity.UnitOfMeasure;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateTradeRequest(
    @NotNull TradeType tradeType,
    @NotNull Long counterpartyId,
    @NotNull Long commodityId,
    @NotNull Long bookId,
    @NotNull LocalDate tradeDate,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @NotNull @Positive BigDecimal quantity,
    @NotNull UnitOfMeasure quantityUnit,
    @NotNull PricingType pricingType,
    BigDecimal fixedPrice,
    Long priceIndexId,
    Long priceFormulaId,
    BigDecimal spread,
    @NotBlank @Size(min = 3, max = 3) String currency,
    @Size(max = 50) String externalReference,
    @Size(max = 2000) String internalNotes
) {}
