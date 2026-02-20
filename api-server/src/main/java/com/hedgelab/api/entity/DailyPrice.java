package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "daily_prices",
    uniqueConstraints = @UniqueConstraint(name = "uq_daily_price", columnNames = {"price_index_id", "price_date", "price_type"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailyPrice {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "daily_price_seq")
    @SequenceGenerator(name = "daily_price_seq", sequenceName = "daily_price_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_index_id", nullable = false)
    private PriceIndex priceIndex;

    @Column(name = "price_date", nullable = false)
    private LocalDate priceDate;

    @Column(name = "price", precision = 20, scale = 6, nullable = false)
    private BigDecimal price;

    @Column(name = "price_type", length = 10, nullable = false)
    @Builder.Default
    private String priceType = "SETTLE";

    @Column(name = "source", length = 50)
    private String source;

    @Column(name = "confirmed", nullable = false)
    @Builder.Default
    private boolean confirmed = true;

    @Column(name = "published_at")
    private Instant publishedAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;
}
