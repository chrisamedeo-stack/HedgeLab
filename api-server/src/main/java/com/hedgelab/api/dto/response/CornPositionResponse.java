package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Top-level response for GET /api/v1/corn/positions.
 * Five-panel position view: Hedge Book, Site Allocations, Physical, Locked, Offsets.
 */
@Data
@Builder
public class CornPositionResponse {

    /** Hedge Book — open/partially-allocated hedges with unallocated bushels */
    private List<HedgeBookItem> hedgeBook;

    /** Site Allocations — allocated futures per site/month */
    private List<SiteAllocationItem> siteAllocations;

    /** Month-only allocations (siteCode IS NULL) awaiting site assignment */
    private List<MonthAllocationItem> monthAllocations;

    /** Active physical contracts showing commitment, basis, pricing, and trade type */
    private List<PhysicalPositionItem> physicalPositions;

    /** EFP tickets — locked positions with gain/loss tracking */
    private List<LockedPositionItem> lockedPositions;

    /** Closed offsets — futures closed without EFP */
    private List<OffsetItem> offsets;

    /** Latest published settle price per futures month ($/bu) */
    private Map<String, BigDecimal> latestSettles;

    // -------------------------------------------------------------------------

    @Data
    @Builder
    public static class HedgeBookItem {
        private Long hedgeTradeId;
        private String tradeRef;
        private String futuresMonth;
        private Integer lots;
        private Integer bushels;            // lots × 5000
        private Integer openLots;
        private Integer allocatedLots;
        private Integer allocatedBushels;
        private Integer unallocatedLots;
        private Integer unallocatedBushels;
        private BigDecimal entryPrice;      // $/bu
        private BigDecimal settlePrice;     // $/bu — null until settle published
        private BigDecimal mtmPnlUsd;       // on unallocated lots only
        private BigDecimal unallocatedMt;
        private List<String> validDeliveryMonths;
        private String status;
        private String brokerAccount;
        private String side;             // LONG or SHORT
    }

    @Data
    @Builder
    public static class SiteAllocationItem {
        private Long allocationId;
        private Long hedgeTradeId;
        private String tradeRef;
        private String futuresMonth;
        private String siteCode;
        private String siteName;
        private String budgetMonth;
        private Integer allocatedLots;
        private Integer allocatedBushels;
        private BigDecimal allocatedMt;
        private BigDecimal entryPrice;      // ¢/bu
        private BigDecimal settlePrice;     // ¢/bu
        private BigDecimal mtmPnlUsd;
        private Integer efpdLots;
        private Integer offsetLots;
        private Integer openAllocatedLots;
        private String side;             // LONG or SHORT (from parent hedge)
        private LocalDate tradeDate;     // from parent hedge trade
    }

    @Data
    @Builder
    public static class MonthAllocationItem {
        private Long allocationId;
        private Long hedgeTradeId;
        private String tradeRef;
        private String futuresMonth;
        private String budgetMonth;
        private Integer allocatedLots;
        private Integer allocatedBushels;
        private BigDecimal allocatedMt;
        private BigDecimal entryPrice;      // $/bu from parent hedge
        private String side;
        private LocalDate tradeDate;
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
        private BigDecimal basisValue;      // $/bu — null if not yet locked
        private boolean basisLocked;
        private BigDecimal boardPriceLocked; // $/bu — null until EFP
        private boolean efpExecuted;
        private BigDecimal allInPricePerMt;  // null until both board and basis are set
        private String status;
        private String tradeType;           // INDEX or BASIS
        private String futuresRef;          // e.g. ZCN26
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
        private BigDecimal boardPrice;      // $/bu
        private BigDecimal basisValue;      // $/bu from physical contract
        private BigDecimal freightValue;    // $/MT from physical contract
        private BigDecimal allInPricePerMt;
        private BigDecimal quantityMt;
        private LocalDate efpDate;
        private String confirmationRef;
        private String status;
        // Gain/loss fields
        private BigDecimal entryPrice;          // $/bu — hedge entry at EFP time
        private BigDecimal futuresBuyPrice;     // = entryPrice
        private BigDecimal futuresSellPrice;    // = boardPrice
        private BigDecimal gainLossPerBu;       // sell − buy
        private BigDecimal gainLossUsd;         // (sell − buy) × lots × 5000
        private BigDecimal gainLossPerMt;       // (sell − buy) × 39.3683
        private BigDecimal effectiveAllInPerMt; // allInPerMt − gainLossPerMt
    }

    @Data
    @Builder
    public static class OffsetItem {
        private Long offsetId;
        private String tradeRef;
        private String futuresMonth;
        private String siteCode;
        private String siteName;
        private Integer lots;
        private Integer bushels;
        private BigDecimal entryPrice;      // $/bu
        private BigDecimal exitPrice;       // $/bu
        private BigDecimal pnlPerBu;
        private BigDecimal pnlUsd;
        private LocalDate offsetDate;
        private String notes;
    }
}
