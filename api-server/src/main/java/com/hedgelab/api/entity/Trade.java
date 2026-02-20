package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "trades", uniqueConstraints = @UniqueConstraint(name = "uq_trade_ref", columnNames = "trade_reference"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Trade extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "trade_seq")
    @SequenceGenerator(name = "trade_seq", sequenceName = "trade_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "trade_reference", length = 30, nullable = false)
    private String tradeReference;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_type", length = 20, nullable = false)
    private TradeType tradeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 25, nullable = false)
    @Builder.Default
    private TradeStatus status = TradeStatus.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "counterparty_id", nullable = false)
    private Counterparty counterparty;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commodity_id", nullable = false)
    private Commodity commodity;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "quantity", precision = 20, scale = 6, nullable = false)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "quantity_unit", length = 20)
    private UnitOfMeasure quantityUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_type", length = 20, nullable = false)
    private PricingType pricingType;

    @Column(name = "fixed_price", precision = 20, scale = 6)
    private BigDecimal fixedPrice;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_index_id")
    private PriceIndex priceIndex;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_formula_id")
    private PriceFormula priceFormula;

    @Column(name = "spread", precision = 20, scale = 6)
    @Builder.Default
    private BigDecimal spread = BigDecimal.ZERO;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Column(name = "notional_usd", precision = 24, scale = 2)
    private BigDecimal notionalUsd;

    @Column(name = "mtm_value_usd", precision = 24, scale = 2)
    private BigDecimal mtmValueUsd;

    @Column(name = "unrealized_pnl_usd", precision = 24, scale = 2)
    private BigDecimal unrealizedPnlUsd;

    @Column(name = "external_reference", length = 50)
    private String externalReference;

    @Column(name = "internal_notes", length = 2000)
    private String internalNotes;

    // Amendment tracking
    @Column(name = "amendment_count")
    @Builder.Default
    private Integer amendmentCount = 0;

    @Column(name = "amended_at")
    private Instant amendedAt;

    @Column(name = "amended_by", length = 100)
    private String amendedBy;

    @Column(name = "amendment_reason", columnDefinition = "TEXT")
    private String amendmentReason;

    // Implied volatility (for option trades)
    @Column(name = "implied_volatility", precision = 10, scale = 6)
    private BigDecimal impliedVolatility;

    @OneToMany(mappedBy = "trade", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("deliveryMonth ASC")
    @Builder.Default
    private List<DeliverySchedule> deliverySchedules = new ArrayList<>();

    @Version
    @Column(name = "version")
    private Integer version;
}
