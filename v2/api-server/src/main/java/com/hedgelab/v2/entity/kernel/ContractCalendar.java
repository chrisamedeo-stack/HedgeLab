package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "commodity_contract_calendar", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"commodity_id", "contract_month"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ContractCalendar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "contract_month", nullable = false, length = 10)
    private String contractMonth;

    @Column(name = "first_notice_date")
    private LocalDate firstNoticeDate;

    @Column(name = "last_trade_date")
    private LocalDate lastTradeDate;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "first_delivery_date")
    private LocalDate firstDeliveryDate;

    @Column(name = "last_delivery_date")
    private LocalDate lastDeliveryDate;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @Column(length = 50)
    @Builder.Default
    private String source = "manual";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
