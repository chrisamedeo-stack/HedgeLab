package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pm_rollover_costs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RolloverCost {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rollover_id", nullable = false)
    private UUID rolloverId;

    @Column(name = "spread_cost")
    @Builder.Default
    private BigDecimal spreadCost = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal commission = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal fees = BigDecimal.ZERO;

    @Column(name = "total_cost")
    @Builder.Default
    private BigDecimal totalCost = BigDecimal.ZERO;

    @Column(name = "cost_allocation", length = 20)
    @Builder.Default
    private String costAllocation = "site";

    @Column(name = "site_id")
    private UUID siteId;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
