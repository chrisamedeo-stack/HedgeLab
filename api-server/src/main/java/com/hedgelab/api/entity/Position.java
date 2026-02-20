package com.hedgelab.api.entity;

import com.hedgelab.api.converter.YearMonthConverter;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.YearMonth;

@Entity
@Table(name = "positions",
    uniqueConstraints = @UniqueConstraint(name = "uq_position", columnNames = {"book_id", "commodity_id", "delivery_month", "position_type"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "position_seq")
    @SequenceGenerator(name = "position_seq", sequenceName = "position_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "commodity_id", nullable = false)
    private Commodity commodity;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "delivery_month", length = 7, nullable = false)
    private YearMonth deliveryMonth;

    @Enumerated(EnumType.STRING)
    @Column(name = "position_type", length = 15, nullable = false)
    private PositionType positionType;

    @Column(name = "long_qty", precision = 20, scale = 6)
    @Builder.Default
    private BigDecimal longQuantity = BigDecimal.ZERO;

    @Column(name = "short_qty", precision = 20, scale = 6)
    @Builder.Default
    private BigDecimal shortQuantity = BigDecimal.ZERO;

    @Column(name = "net_qty", precision = 20, scale = 6)
    @Builder.Default
    private BigDecimal netQuantity = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "quantity_unit", length = 20)
    private UnitOfMeasure quantityUnit;

    @Column(name = "avg_long_price", precision = 20, scale = 6)
    private BigDecimal avgLongPrice;

    @Column(name = "avg_short_price", precision = 20, scale = 6)
    private BigDecimal avgShortPrice;

    @Column(name = "last_updated")
    private Instant lastUpdated;

    @Version
    @Column(name = "version")
    private Integer version;
}
