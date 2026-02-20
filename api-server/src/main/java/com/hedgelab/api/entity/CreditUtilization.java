package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "credit_utilizations",
    uniqueConstraints = @UniqueConstraint(name = "uq_credit_util", columnNames = {"counterparty_id", "snapshot_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CreditUtilization {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "credit_util_seq")
    @SequenceGenerator(name = "credit_util_seq", sequenceName = "credit_util_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "counterparty_id", nullable = false)
    private Counterparty counterparty;

    @Column(name = "snapshot_date", nullable = false)
    private LocalDate snapshotDate;

    @Column(name = "approved_limit_usd", precision = 22, scale = 2)
    private BigDecimal approvedLimitUsd;

    @Column(name = "current_exposure_usd", precision = 22, scale = 2)
    @Builder.Default
    private BigDecimal currentExposureUsd = BigDecimal.ZERO;

    @Column(name = "utilization_pct", precision = 7, scale = 3)
    private BigDecimal utilizationPct;

    @Column(name = "alert_level", length = 10)
    @Builder.Default
    private String alertLevel = "GREEN";

    @Column(name = "calculated_at")
    private Instant calculatedAt;
}
