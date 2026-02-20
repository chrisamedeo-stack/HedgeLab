package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateReceiptRequest {
    private Long physicalContractId;
    private String siteCode;
    private LocalDate receiptDate;
    private BigDecimal grossMt;
    private BigDecimal moisturePct;
    private BigDecimal deliveredCostPerMt;
    private String vehicleRef;
    private String notes;
}
