package com.hedgelab.api.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class HedgeAllocationResponse {
    private Long id;
    private Long hedgeTradeId;
    private String tradeRef;
    private String siteCode;
    private String siteName;
    private String budgetMonth;
    private Integer allocatedLots;
    private double allocatedMt;
    private String notes;
    private LocalDateTime createdAt;
}
