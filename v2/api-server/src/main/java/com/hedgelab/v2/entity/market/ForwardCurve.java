package com.hedgelab.v2.entity.market;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "md_forward_curves", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"commodity_id", "curve_date", "contract_month"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ForwardCurve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "curve_date", nullable = false)
    private LocalDate curveDate;

    @Column(name = "contract_month", nullable = false, length = 10)
    private String contractMonth;

    @Column(nullable = false)
    private BigDecimal price;

    @Column(length = 50)
    @Builder.Default
    private String source = "manual";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
