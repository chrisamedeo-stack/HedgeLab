package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.MtmValuation;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MtmValuationResponse(
    Long id,
    Long tradeId,
    String tradeReference,
    LocalDate valuationDate,
    BigDecimal marketPrice,
    BigDecimal tradePrice,
    BigDecimal mtmPriceUsd,
    BigDecimal openQuantity,
    BigDecimal mtmValueUsd,
    BigDecimal fxRateToUsd,
    String valuationMethod
) {
    public static MtmValuationResponse from(MtmValuation m) {
        return new MtmValuationResponse(
            m.getId(), m.getTrade().getId(), m.getTrade().getTradeReference(),
            m.getValuationDate(), m.getMarketPrice(), m.getTradePrice(),
            m.getMtmPriceUsd(), m.getOpenQuantity(), m.getMtmValueUsd(),
            m.getFxRateToUsd(), m.getValuationMethod()
        );
    }
}
