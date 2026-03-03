package com.hedgelab.v2.entity.budget;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "bgt_line_items", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"period_id", "budget_month"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BudgetLineItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "period_id", nullable = false)
    private UUID periodId;

    @Column(name = "budget_month", nullable = false, length = 10)
    private String budgetMonth;

    @Column(name = "budgeted_volume", nullable = false)
    @Builder.Default
    private BigDecimal budgetedVolume = BigDecimal.ZERO;

    @Column(name = "budget_price")
    private BigDecimal budgetPrice;

    // budget_cost is GENERATED ALWAYS STORED — read-only
    @Column(name = "budget_cost", insertable = false, updatable = false)
    private BigDecimal budgetCost;

    @Column(name = "committed_volume", nullable = false)
    @Builder.Default
    private BigDecimal committedVolume = BigDecimal.ZERO;

    @Column(name = "committed_avg_price")
    private BigDecimal committedAvgPrice;

    @Column(name = "committed_cost", nullable = false)
    @Builder.Default
    private BigDecimal committedCost = BigDecimal.ZERO;

    @Column(name = "hedged_volume", nullable = false)
    @Builder.Default
    private BigDecimal hedgedVolume = BigDecimal.ZERO;

    @Column(name = "hedged_avg_price")
    private BigDecimal hedgedAvgPrice;

    @Column(name = "hedged_cost", nullable = false)
    @Builder.Default
    private BigDecimal hedgedCost = BigDecimal.ZERO;

    // total_covered_volume is GENERATED ALWAYS STORED — read-only
    @Column(name = "total_covered_volume", insertable = false, updatable = false)
    private BigDecimal totalCoveredVolume;

    // coverage_pct is GENERATED ALWAYS STORED — read-only
    @Column(name = "coverage_pct", insertable = false, updatable = false)
    private BigDecimal coveragePct;

    // open_volume is GENERATED ALWAYS STORED — read-only
    @Column(name = "open_volume", insertable = false, updatable = false)
    private BigDecimal openVolume;

    @Column(name = "forecast_volume")
    private BigDecimal forecastVolume;

    @Column(name = "forecast_price")
    private BigDecimal forecastPrice;

    @Column(name = "futures_month", length = 20)
    private String futuresMonth;

    @Column(columnDefinition = "text")
    private String notes;

    // ---- Transient (computed) fields ----

    @Transient
    private List<BudgetLineItemComponent> components;

    @Transient
    private BigDecimal targetAllInPrice;

    @Transient
    private Boolean overHedged;

    @Transient
    private BigDecimal totalNotional;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
