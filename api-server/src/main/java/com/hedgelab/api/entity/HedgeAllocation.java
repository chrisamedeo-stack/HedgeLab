package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "corn_hedge_allocations",
       uniqueConstraints = @UniqueConstraint(columnNames = {"hedge_trade_id", "site_id", "budget_month"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HedgeAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hedge_trade_id", nullable = false)
    private HedgeTrade hedgeTrade;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;

    /** Budget month this allocation covers, e.g. "2026-05" */
    @Column(name = "budget_month", nullable = false, length = 7)
    private String budgetMonth;

    /** Number of lots allocated from the hedge trade to this site/month */
    @Column(name = "allocated_lots", nullable = false)
    private Integer allocatedLots;

    private String notes;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
