package com.hedgelab.api.entity;

import com.hedgelab.api.converter.YearMonthConverter;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;

@Entity
@Table(name = "forward_curve_points",
    uniqueConstraints = @UniqueConstraint(name = "uq_fwd_curve", columnNames = {"price_index_id", "curve_date", "delivery_month"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ForwardCurvePoint {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "fwd_curve_seq")
    @SequenceGenerator(name = "fwd_curve_seq", sequenceName = "fwd_curve_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "price_index_id", nullable = false)
    private PriceIndex priceIndex;

    @Column(name = "curve_date", nullable = false)
    private LocalDate curveDate;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "delivery_month", length = 7, nullable = false)
    private YearMonth deliveryMonth;

    @Column(name = "forward_price", precision = 20, scale = 6, nullable = false)
    private BigDecimal forwardPrice;

    @Column(name = "created_at")
    private Instant createdAt;
}
