package com.hedgelab.api.entity;

import com.hedgelab.api.converter.YearMonthConverter;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.YearMonth;

@Entity
@Table(name = "delivery_schedules",
    uniqueConstraints = @UniqueConstraint(name = "uq_delivery", columnNames = {"trade_id", "delivery_month"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeliverySchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "delivery_seq")
    @SequenceGenerator(name = "delivery_seq", sequenceName = "delivery_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_id", nullable = false)
    private Trade trade;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "delivery_month", length = 7, nullable = false)
    private YearMonth deliveryMonth;

    @Column(name = "scheduled_quantity", precision = 20, scale = 6, nullable = false)
    private BigDecimal scheduledQuantity;

    @Column(name = "delivered_quantity", precision = 20, scale = 6)
    @Builder.Default
    private BigDecimal deliveredQuantity = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 15, nullable = false)
    @Builder.Default
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Column(name = "delivery_location", length = 100)
    private String deliveryLocation;

    @Column(name = "nomination_ref", length = 50)
    private String nominationRef;
}
