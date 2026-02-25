package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class UpdatePhysicalContractRequest {
    private String siteCode;
    private String supplierName;
    private BigDecimal quantityBu;
    private BigDecimal quantityMt;
    private String deliveryMonth;
    private BigDecimal basisPerBu;
    private String futuresRef;
    private BigDecimal freightPerMt;
    private String currency;
    private LocalDate contractDate;
    private String notes;
    private String tradeType;
    private BigDecimal boardPricePerBu;
}
