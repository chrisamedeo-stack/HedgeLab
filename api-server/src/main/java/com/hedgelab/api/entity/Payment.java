package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "payments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "payment_seq")
    @SequenceGenerator(name = "payment_seq", sequenceName = "payment_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "amount_usd", precision = 24, scale = 2, nullable = false)
    private BigDecimal amountUsd;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Column(name = "fx_rate_to_usd", precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal fxRateToUsd = BigDecimal.ONE;

    @Column(name = "payment_reference", length = 50)
    private String paymentReference;

    @Column(name = "payment_method", length = 20)
    @Builder.Default
    private String paymentMethod = "SWIFT";

    @Column(name = "recorded_at")
    private Instant recordedAt;

    @Column(name = "recorded_by", length = 100)
    private String recordedBy;
}
