package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "risk_metrics")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class RiskMetric {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "risk_seq")
    @SequenceGenerator(name = "risk_seq", sequenceName = "risk_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id")
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commodity_id")
    private Commodity commodity;

    @Enumerated(EnumType.STRING)
    @Column(name = "metric_type", length = 30, nullable = false)
    private RiskMetricType metricType;

    @Column(name = "metric_date", nullable = false)
    private LocalDate metricDate;

    @Column(name = "metric_value", precision = 24, scale = 6, nullable = false)
    private BigDecimal metricValue;

    @Column(name = "currency", length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "methodology", length = 200)
    private String methodology;

    @Column(name = "calculated_at")
    private Instant calculatedAt;
}
