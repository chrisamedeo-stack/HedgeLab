package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "fx_rates", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"from_currency", "to_currency", "rate_date"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FxRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "from_currency", nullable = false, length = 3)
    private String fromCurrency;

    @Column(name = "to_currency", nullable = false, length = 3)
    private String toCurrency;

    @Column(name = "rate_date", nullable = false)
    private LocalDate rateDate;

    @Column(nullable = false, precision = 12, scale = 6)
    private BigDecimal rate;

    @Column(length = 50)
    @Builder.Default
    private String source = "manual";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
