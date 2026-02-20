package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.Position;
import com.hedgelab.api.entity.PositionType;
import com.hedgelab.api.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;

public record PositionResponse(
    Long id,
    String bookCode,
    String commodityCode,
    YearMonth deliveryMonth,
    PositionType positionType,
    BigDecimal longQuantity,
    BigDecimal shortQuantity,
    BigDecimal netQuantity,
    UnitOfMeasure quantityUnit,
    BigDecimal avgLongPrice,
    BigDecimal avgShortPrice,
    Instant lastUpdated
) {
    public static PositionResponse from(Position p) {
        return new PositionResponse(
            p.getId(), p.getBook().getBookCode(), p.getCommodity().getCode(),
            p.getDeliveryMonth(), p.getPositionType(),
            p.getLongQuantity(), p.getShortQuantity(), p.getNetQuantity(),
            p.getQuantityUnit(), p.getAvgLongPrice(), p.getAvgShortPrice(), p.getLastUpdated()
        );
    }
}
