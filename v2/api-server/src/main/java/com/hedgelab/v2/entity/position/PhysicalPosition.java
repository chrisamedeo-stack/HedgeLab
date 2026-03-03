package com.hedgelab.v2.entity.position;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "pm_physical_positions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PhysicalPosition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "contract_id")
    private UUID contractId;

    @Column(nullable = false, length = 10)
    private String direction;

    @Column(nullable = false)
    private BigDecimal volume;

    private BigDecimal price;

    @Column(name = "pricing_type", length = 20)
    @Builder.Default
    private String pricingType = "fixed";

    @Column(name = "basis_price")
    private BigDecimal basisPrice;

    @Column(name = "basis_month", length = 10)
    private String basisMonth;

    @Column(name = "delivery_month", length = 10)
    private String deliveryMonth;

    @Column(length = 200)
    private String counterparty;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "open";

    @Column(name = "import_job_id")
    private UUID importJobId;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
