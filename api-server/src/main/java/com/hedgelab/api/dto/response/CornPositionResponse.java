package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Top-level response for GET /api/v1/corn/positions.
 * Aggregates three position views plus the latest settle prices.
 */
@Data
@Builder
public class CornPositionResponse {

    /** Open/partially-allocated hedge trades forming the corporate pool */
    private List<CorporatePoolItem> corporatePool;

    /** Active physical contracts showing commitment, basis, and pricing status */
    private List<PhysicalPositionItem> physicalPositions;

    /** EFP tickets — positions with a locked board price */
    private List<LockedPositionItem> lockedPositions;

    /** Latest published settle price per futures month (¢/bu) */
    private Map<String, BigDecimal> latestSettles;

    // -------------------------------------------------------------------------

    @Data
    @Builder
    public static class CorporatePoolItem {
        private Long hedgeTradeId;
        private String tradeRef;
        private String futuresMonth;
        private Integer lots;
        private Integer openLots;
        private BigDecimal entryPrice;      // ¢/bu
        private BigDecimal settlePrice;     // ¢/bu — null until settle is published
        private BigDecimal mtmPnlUsd;       // openLots × 5000 × (settle − entry) / 100
        private BigDecimal openMt;          // openLots × 5000 / 39.3683
        private List<String> validDeliveryMonths;
        private String status;
        private String brokerAccount;
    }

    @Data
    @Builder
    public static class PhysicalPositionItem {
        private Long contractId;
        private String contractRef;
        private String deliveryMonth;
        private String siteCode;
        private String siteName;
        private String supplierName;
        private BigDecimal committedMt;
        private BigDecimal basisValue;      // ¢/bu — null if not yet locked
        private boolean basisLocked;
        private BigDecimal boardPriceLocked; // ¢/bu — null until EFP
        private boolean efpExecuted;
        private BigDecimal allInPricePerMt;  // null until both board and basis are set
        private String status;
    }

    @Data
    @Builder
    public static class LockedPositionItem {
        private Long efpTicketId;
        private String ticketRef;
        private String siteCode;
        private String siteName;
        private String supplierName;
        private String deliveryMonth;
        private String futuresMonth;
        private Integer lots;
        private BigDecimal boardPrice;      // ¢/bu
        private BigDecimal basisValue;      // ¢/bu from physical contract
        private BigDecimal freightValue;    // $/MT from physical contract
        private BigDecimal allInPricePerMt;
        private BigDecimal quantityMt;
        private LocalDate efpDate;
        private String confirmationRef;
        private String status;
    }
}
