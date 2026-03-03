package com.hedgelab.v2.entity.market;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "md_prices", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"commodity_id", "contract_month", "price_date", "price_type"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class MarketPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "contract_month", nullable = false, length = 10)
    private String contractMonth;

    @Column(name = "price_date", nullable = false)
    private LocalDate priceDate;

    @Column(name = "price_type", nullable = false, length = 20)
    @Builder.Default
    private String priceType = "settlement";

    @Column(nullable = false)
    private BigDecimal price;

    @Column(name = "open_price")
    private BigDecimal openPrice;

    @Column(name = "high_price")
    private BigDecimal highPrice;

    @Column(name = "low_price")
    private BigDecimal lowPrice;

    private Long volume;

    @Column(name = "open_interest")
    private Long openInterest;

    @Column(length = 50)
    @Builder.Default
    private String source = "manual";

    @Column(name = "import_job_id")
    private UUID importJobId;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
