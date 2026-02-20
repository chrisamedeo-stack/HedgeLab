package com.hedgelab.api.dto.request;

import lombok.Data;

@Data
public class CreateHedgeAllocationRequest {
    private String siteCode;
    private String budgetMonth; // YYYY-MM
    private Integer allocatedLots;
    private String notes;
}
