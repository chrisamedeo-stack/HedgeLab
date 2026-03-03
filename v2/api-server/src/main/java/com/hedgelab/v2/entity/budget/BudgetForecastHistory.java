package com.hedgelab.v2.entity.budget;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "bgt_forecast_history")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BudgetForecastHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "line_item_id", nullable = false)
    private UUID lineItemId;

    @Column(name = "forecast_volume")
    private BigDecimal forecastVolume;

    @Column(name = "forecast_price")
    private BigDecimal forecastPrice;

    @Column(name = "recorded_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant recordedAt = Instant.now();

    @Column(name = "recorded_by")
    private String recordedBy;

    @Column(columnDefinition = "text")
    private String notes;
}
