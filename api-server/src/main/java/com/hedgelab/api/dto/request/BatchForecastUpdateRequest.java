package com.hedgelab.api.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class BatchForecastUpdateRequest {

    private String note;
    private List<ForecastLineUpdate> updates;

    @Data
    public static class ForecastLineUpdate {
        private Long budgetLineId;
        private BigDecimal forecastVolumeMt;
    }
}
