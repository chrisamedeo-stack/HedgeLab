package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pm_rollover_legs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RolloverLeg {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rollover_id", nullable = false)
    private UUID rolloverId;

    @Column(name = "leg_type", nullable = false, length = 10)
    private String legType;

    @Column(name = "commodity_id", length = 20)
    private String commodityId;

    @Column(name = "contract_month", length = 10)
    private String contractMonth;

    @Column(nullable = false)
    private BigDecimal volume;

    private BigDecimal price;

    @Column(name = "num_contracts")
    private Integer numContracts;

    @Column(name = "trade_id")
    private UUID tradeId;

    @Column(name = "allocation_id")
    private UUID allocationId;

    @Column(name = "realized_pnl")
    private BigDecimal realizedPnl;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
