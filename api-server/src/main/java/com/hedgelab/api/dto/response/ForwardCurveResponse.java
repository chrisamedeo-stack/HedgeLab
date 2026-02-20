package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.ForwardCurvePoint;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

public record ForwardCurveResponse(
    String indexCode,
    LocalDate curveDate,
    YearMonth deliveryMonth,
    BigDecimal forwardPrice
) {
    public static ForwardCurveResponse from(ForwardCurvePoint fp) {
        return new ForwardCurveResponse(
            fp.getPriceIndex().getIndexCode(), fp.getCurveDate(),
            fp.getDeliveryMonth(), fp.getForwardPrice()
        );
    }
}
