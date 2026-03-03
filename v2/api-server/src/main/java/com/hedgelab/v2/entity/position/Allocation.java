package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "pm_allocations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Allocation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "trade_id")
    private UUID tradeId;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "allocated_volume", nullable = false)
    private BigDecimal allocatedVolume;

    @Column(name = "budget_month", length = 10)
    private String budgetMonth;

    @Column(name = "allocation_date", nullable = false)
    @Builder.Default
    private LocalDate allocationDate = LocalDate.now();

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "open";

    @Column(name = "trade_price")
    private BigDecimal tradePrice;

    @Column(name = "trade_date")
    private LocalDate tradeDate;

    @Column(name = "contract_month", length = 10)
    private String contractMonth;

    @Column(length = 10)
    private String direction;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "efp_date")
    private LocalDate efpDate;

    @Column(name = "efp_price")
    private BigDecimal efpPrice;

    @Column(name = "efp_volume")
    private BigDecimal efpVolume;

    @Column(name = "futures_pnl")
    private BigDecimal futuresPnl;

    @Column(name = "offset_date")
    private LocalDate offsetDate;

    @Column(name = "offset_price")
    private BigDecimal offsetPrice;

    @Column(name = "offset_volume")
    private BigDecimal offsetVolume;

    @Column(name = "offset_pnl")
    private BigDecimal offsetPnl;

    @Column(name = "rolled_from_allocation_id")
    private UUID rolledFromAllocationId;

    @Column(name = "roll_id")
    private UUID rollId;

    @Column(name = "allocated_by")
    private UUID allocatedBy;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "import_job_id")
    private UUID importJobId;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();

    // Transient fields for joined data
    @Transient
    private String siteName;
    @Transient
    private String siteCode;
    @Transient
    private String commodityName;
    @Transient
    private String region;
}
