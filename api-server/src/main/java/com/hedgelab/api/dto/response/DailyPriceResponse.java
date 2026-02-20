package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.DailyPrice;

import java.math.BigDecimal;
import java.time.LocalDate;

public record DailyPriceResponse(
    Long id,
    String indexCode,
    LocalDate priceDate,
    BigDecimal price,
    String priceType,
    String source,
    boolean confirmed
) {
    public static DailyPriceResponse from(DailyPrice dp) {
        return new DailyPriceResponse(
            dp.getId(), dp.getPriceIndex().getIndexCode(),
            dp.getPriceDate(), dp.getPrice(), dp.getPriceType(), dp.getSource(), dp.isConfirmed()
        );
    }
}
