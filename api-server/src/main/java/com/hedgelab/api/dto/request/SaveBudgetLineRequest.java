package com.hedgelab.api.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class SaveBudgetLineRequest {

    private String siteCode;
    private String commodityCode;   // e.g. "CORN-ZC"
    private String budgetMonth;     // YYYY-MM
    private String futuresMonth;    // e.g. "ZCN26"
    private BigDecimal budgetVolumeMt;
    private BigDecimal budgetVolumeBu;
    private String fiscalYear;      // e.g. "2025/2026" (Jul–Jun) — takes priority over cropYear
    private String cropYear;        // kept for backward compat — use fiscalYear going forward
    private String notes;

    private BigDecimal forecastVolumeMt;
    private BigDecimal forecastVolumeBu;
    private String forecastNotes;

    private List<ComponentDto> components;

    @Data
    public static class ComponentDto {
        private String componentName;
        private String unit;
        private BigDecimal targetValue;
        private Integer displayOrder;
    }
}
