package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "pm_locked_positions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class LockedPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "allocation_id", nullable = false)
    private UUID allocationId;

    @Column(name = "site_id")
    private UUID siteId;

    @Column(name = "commodity_id", length = 20)
    private String commodityId;

    @Column(nullable = false)
    private BigDecimal volume;

    @Column(name = "locked_price", nullable = false)
    private BigDecimal lockedPrice;

    @Column(name = "futures_component")
    private BigDecimal futuresComponent;

    @Column(name = "basis_component")
    private BigDecimal basisComponent;

    @Column(name = "futures_pnl")
    private BigDecimal futuresPnl;

    @Column(name = "all_in_price")
    private BigDecimal allInPrice;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "lock_date", nullable = false)
    @Builder.Default
    private LocalDate lockDate = LocalDate.now();

    @Column(name = "delivery_month", length = 10)
    private String deliveryMonth;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
