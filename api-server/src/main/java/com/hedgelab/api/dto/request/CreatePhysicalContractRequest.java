package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreatePhysicalContractRequest {
    private String siteCode;
    private String supplierName;       // free-text
    private String commodityCode;      // defaults to "CORN-ZC"
    private BigDecimal quantityBu;     // bushels — server derives MT
    private BigDecimal quantityMt;     // OR MT directly
    private String deliveryMonth;      // YYYY-MM
    private BigDecimal basisCentsBu;   // ¢/bu (negative ok)
    private String futuresRef;         // e.g. ZCN26
    private BigDecimal freightPerMt;   // $/MT
    private String currency;           // USD or CAD
    private LocalDate contractDate;
    private String notes;
    private String tradeType;              // INDEX, BASIS, or ALL_IN (defaults to BASIS)
    private BigDecimal boardPriceCentsBu;  // ¢/bu — required for ALL_IN trades
}
