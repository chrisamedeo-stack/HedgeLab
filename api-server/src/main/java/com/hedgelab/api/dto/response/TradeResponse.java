package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record TradeResponse(
    Long id,
    String tradeReference,
    TradeType tradeType,
    TradeStatus status,
    Long counterpartyId,
    String counterpartyName,
    Long commodityId,
    String commodityCode,
    Long bookId,
    String bookCode,
    LocalDate tradeDate,
    LocalDate startDate,
    LocalDate endDate,
    BigDecimal quantity,
    UnitOfMeasure quantityUnit,
    PricingType pricingType,
    BigDecimal fixedPrice,
    String priceIndexCode,
    String priceFormulaCode,
    BigDecimal spread,
    String currency,
    BigDecimal notionalUsd,
    BigDecimal mtmValueUsd,
    BigDecimal unrealizedPnlUsd,
    String externalReference,
    String internalNotes,
    Integer version,
    Instant createdAt,
    Instant updatedAt
) {
    public static TradeResponse from(Trade t) {
        return new TradeResponse(
            t.getId(), t.getTradeReference(), t.getTradeType(), t.getStatus(),
            t.getCounterparty().getId(), t.getCounterparty().getShortName(),
            t.getCommodity().getId(), t.getCommodity().getCode(),
            t.getBook().getId(), t.getBook().getBookCode(),
            t.getTradeDate(), t.getStartDate(), t.getEndDate(),
            t.getQuantity(), t.getQuantityUnit(),
            t.getPricingType(), t.getFixedPrice(),
            t.getPriceIndex() != null ? t.getPriceIndex().getIndexCode() : null,
            t.getPriceFormula() != null ? t.getPriceFormula().getFormulaCode() : null,
            t.getSpread(), t.getCurrency(),
            t.getNotionalUsd(), t.getMtmValueUsd(), t.getUnrealizedPnlUsd(),
            t.getExternalReference(), t.getInternalNotes(),
            t.getVersion(), t.getCreatedAt(), t.getUpdatedAt()
        );
    }
}
