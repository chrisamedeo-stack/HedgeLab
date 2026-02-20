package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "corn_physical_contracts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PhysicalContract extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String contractRef; // e.g. PC-GM1-2025-001
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @Column(name = "supplier_name")
    private String supplierName; // free-text until settings schema is built
    private String commodityCode;
    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal quantityMt;
    private String deliveryMonth; // YYYY-MM
    @Column(precision = 10, scale = 4)
    private BigDecimal basisCentsBu; // ¢/bu (negative = discount under futures)
    @Column(precision = 10, scale = 4)
    private BigDecimal freightPerMt; // $/MT
    private String currency; // USD or CAD
    private String futuresRef; // e.g. ZCN26 — the futures month this basis is against
    @Enumerated(EnumType.STRING)
    private PhysicalContractStatus status;
    @Column(precision = 10, scale = 4)
    private BigDecimal boardPriceCentsBu; // ¢/bu, locked via EFP or direct pricing
    private LocalDate basisLockedDate;
    private LocalDate contractDate;
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(name = "trade_type", nullable = false)
    @Builder.Default
    private PhysicalContractTradeType tradeType = PhysicalContractTradeType.BASIS;
}
