package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "corn_forecast_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CornForecastHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "budget_line_id", nullable = false)
    private CornBudgetLine budgetLine;

    @Column(name = "forecast_mt", nullable = false, precision = 14, scale = 4)
    private BigDecimal forecastMt;

    @Column(name = "forecast_bu", nullable = false, precision = 16, scale = 2)
    private BigDecimal forecastBu;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "recorded_by", length = 100)
    private String recordedBy;

    @Column(length = 500)
    private String notes;

    @PrePersist
    void prePersist() {
        if (recordedAt == null) recordedAt = Instant.now();
    }
}
