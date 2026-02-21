package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class CornBudgetLineResponse {

    private Long id;
    private String siteCode;
    private String siteName;
    private String commodityCode;
    private String budgetMonth;
    private String futuresMonth;
    private BigDecimal budgetVolumeMt;
    private BigDecimal budgetVolumeBu;
    private String cropYear;
    private String fiscalYear;
    private String notes;

    /** Computed: sum of all components converted to $/MT */
    private BigDecimal targetAllInPerMt;

    /** Computed: targetAllInPerMt × budgetVolumeMt */
    private BigDecimal totalNotionalSpend;

    /** Forecast fields */
    private BigDecimal forecastVolumeMt;
    private BigDecimal forecastVolumeBu;

    /** Computed: forecastMt − budgetMt */
    private BigDecimal forecastVarianceMt;

    /** Hedged volume from allocations for this site + month */
    private BigDecimal hedgedVolumeMt;

    /** True if hedgedMt > (forecastMt ?? budgetMt) */
    private Boolean overHedged;

    private List<ComponentDto> components;

    @Data
    @Builder
    public static class ComponentDto {
        private Long id;
        private String componentName;
        private String unit;
        private BigDecimal targetValue;
        /** Component value expressed in $/MT for the all-in total */
        private BigDecimal valuePerMt;
        private Integer displayOrder;
    }

    @Data
    @Builder
    public static class ForecastHistoryDto {
        private Long id;
        private BigDecimal forecastMt;
        private BigDecimal forecastBu;
        private Instant recordedAt;
        private String recordedBy;
        private String notes;
    }
}
