package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "pm_rollovers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Rollover {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "commodity_id", length = 20)
    private String commodityId;

    @Column(name = "rollover_type", length = 30)
    @Builder.Default
    private String rolloverType = "contract_month_roll";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "pending";

    @Column(name = "roll_date", nullable = false)
    @Builder.Default
    private LocalDate rollDate = LocalDate.now();

    @Column(name = "close_month", length = 10)
    private String closeMonth;
    @Column(name = "close_volume")
    private BigDecimal closeVolume;
    @Column(name = "close_price")
    private BigDecimal closePrice;
    @Column(name = "close_commodity_id", length = 20)
    private String closeCommodityId;
    @Column(name = "close_realized_pnl")
    private BigDecimal closeRealizedPnl;

    @Column(name = "open_month", length = 10)
    private String openMonth;
    @Column(name = "open_volume")
    private BigDecimal openVolume;
    @Column(name = "open_price")
    private BigDecimal openPrice;
    @Column(name = "open_total_volume")
    private BigDecimal openTotalVolume;

    @Column(name = "spread_price")
    private BigDecimal spreadPrice;
    @Column(name = "spread_cost")
    private BigDecimal spreadCost;

    @Column(name = "source_type", length = 30)
    private String sourceType;
    @Column(name = "source_trade_id")
    private UUID sourceTradeId;
    @Column(name = "source_allocation_id")
    private UUID sourceAllocationId;
    @Column(name = "new_trade_id")
    private UUID newTradeId;
    @Column(name = "new_allocation_id")
    private UUID newAllocationId;

    @Column(name = "auto_reallocate")
    @Builder.Default
    private Boolean autoReallocate = false;
    @Column(name = "reallocation_site_id")
    private UUID reallocationSiteId;
    @Column(name = "reallocation_budget_month", length = 10)
    private String reallocationBudgetMonth;

    @Column(length = 10)
    private String direction;
    @Column(name = "executed_by")
    private UUID executedBy;
    @Column(name = "approved_by")
    private UUID approvedBy;
    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
