package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "mtm_valuations",
    uniqueConstraints = @UniqueConstraint(name = "uq_mtm", columnNames = {"trade_id", "valuation_date"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MtmValuation {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "mtm_seq")
    @SequenceGenerator(name = "mtm_seq", sequenceName = "mtm_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_id", nullable = false)
    private Trade trade;

    @Column(name = "valuation_date", nullable = false)
    private LocalDate valuationDate;

    @Column(name = "market_price", precision = 20, scale = 6, nullable = false)
    private BigDecimal marketPrice;

    @Column(name = "trade_price", precision = 20, scale = 6, nullable = false)
    private BigDecimal tradePrice;

    @Column(name = "mtm_price_usd", precision = 20, scale = 6)
    private BigDecimal mtmPriceUsd;

    @Column(name = "open_quantity", precision = 20, scale = 6)
    private BigDecimal openQuantity;

    @Column(name = "mtm_value_usd", precision = 24, scale = 2, nullable = false)
    private BigDecimal mtmValueUsd;

    @Column(name = "fx_rate_to_usd", precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal fxRateToUsd = BigDecimal.ONE;

    @Column(name = "valuation_method", length = 30)
    @Builder.Default
    private String valuationMethod = "FORWARD_MARK";

    @Column(name = "calculated_at")
    private Instant calculatedAt;
}
