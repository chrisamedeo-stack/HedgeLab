package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class PhysicalContractResponse {
    private Long id;
    private String contractRef;
    private String siteCode;
    private String siteName;
    private String supplierName;
    private String commodityCode;
    private BigDecimal quantityMt;
    private BigDecimal quantityBu;
    private String deliveryMonth;
    private BigDecimal basisCentsBu;      // ¢/bu entered
    private BigDecimal freightPerMt;      // $/MT
    private String futuresRef;            // e.g. ZCN26
    private String currency;
    private String status;
    private BigDecimal boardPriceCentsBu; // ¢/bu locked via EFP
    private LocalDate basisLockedDate;
    private BigDecimal allInCentsBu;      // board + basis (when board is locked)
    private BigDecimal allInPerMt;        // $/MT fully priced (when board is locked)
    private LocalDate contractDate;
    private String notes;
    private String tradeType;               // INDEX or BASIS
}
