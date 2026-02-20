package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class ReceiptResponse {
    private Long id;
    private String ticketRef;
    private String contractRef;
    private String siteCode;
    private String siteName;
    private LocalDate receiptDate;
    private BigDecimal grossMt;
    private BigDecimal netMt;
    private BigDecimal moisturePct;
    private BigDecimal netBushels;
    private BigDecimal deliveredCostPerMt;
    private BigDecimal totalCostUsd;
    private String vehicleRef;
    private String notes;
}
