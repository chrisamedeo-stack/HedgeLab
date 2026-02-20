package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.PnlSnapshot;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PnlResponse(
    String bookCode,
    String commodityCode,
    LocalDate snapshotDate,
    BigDecimal dailyPnlUsd,
    BigDecimal cumulativePnlUsd,
    BigDecimal realizedPnlUsd,
    BigDecimal unrealizedPnlUsd,
    Integer tradeCount
) {
    public static PnlResponse from(PnlSnapshot s) {
        return new PnlResponse(
            s.getBook().getBookCode(),
            s.getCommodity() != null ? s.getCommodity().getCode() : "ALL",
            s.getSnapshotDate(), s.getDailyPnlUsd(), s.getCumulativePnlUsd(),
            s.getRealizedPnlUsd(), s.getUnrealizedPnlUsd(), s.getTradeCount()
        );
    }
}
