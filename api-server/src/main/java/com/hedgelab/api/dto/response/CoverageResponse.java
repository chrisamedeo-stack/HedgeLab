package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
public class CoverageResponse {
    private String siteCode;
    private String siteName;
    private BigDecimal budgetedMt;
    private BigDecimal committedMt;     // sum of open physical contracts
    private BigDecimal hedgedMt;        // sum of hedge allocations in MT equivalent
    private BigDecimal efpdMt;          // sum of EFP tickets quantityMt
    private BigDecimal receivedMt;      // sum of receipts netMt
    private BigDecimal coveragePct;     // hedgedMt / budgetedMt * 100
    private BigDecimal openBasisMt;     // committedMt - efpdMt
    private BigDecimal openHedgeLots;   // total open lots across all hedges
    private List<MonthDetail> months;

    @Data
    @Builder
    public static class MonthDetail {
        private String month;
        private BigDecimal budgetedMt;
        private BigDecimal committedMt;
        private BigDecimal hedgedMt;
        private BigDecimal efpdMt;
        private BigDecimal receivedMt;
        private BigDecimal coveragePct;
    }
}
