package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "pnl_snapshots",
    uniqueConstraints = @UniqueConstraint(name = "uq_pnl", columnNames = {"book_id", "commodity_id", "snapshot_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PnlSnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "pnl_seq")
    @SequenceGenerator(name = "pnl_seq", sequenceName = "pnl_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commodity_id")
    private Commodity commodity;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "daily_pnl_usd", precision = 24, scale = 2)
    private BigDecimal dailyPnlUsd;

    @Column(name = "cumulative_pnl_usd", precision = 24, scale = 2)
    private BigDecimal cumulativePnlUsd;

    @Column(name = "realized_pnl_usd", precision = 24, scale = 2)
    @Builder.Default
    private BigDecimal realizedPnlUsd = BigDecimal.ZERO;

    @Column(name = "unrealized_pnl_usd", precision = 24, scale = 2)
    private BigDecimal unrealizedPnlUsd;

    @Column(name = "trade_count")
    private Integer tradeCount;

    @Column(name = "calculated_at")
    private Instant calculatedAt;
}
