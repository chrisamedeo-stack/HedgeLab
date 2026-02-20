package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.RiskMetric;
import com.hedgelab.api.entity.RiskMetricType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RiskMetricResponse(
    Long id,
    String bookCode,
    String commodityCode,
    RiskMetricType metricType,
    LocalDate metricDate,
    BigDecimal metricValue,
    String currency,
    String methodology
) {
    public static RiskMetricResponse from(RiskMetric r) {
        return new RiskMetricResponse(
            r.getId(),
            r.getBook() != null ? r.getBook().getBookCode() : "FIRM",
            r.getCommodity() != null ? r.getCommodity().getCode() : "ALL",
            r.getMetricType(), r.getMetricDate(), r.getMetricValue(),
            r.getCurrency(), r.getMethodology()
        );
    }
}
