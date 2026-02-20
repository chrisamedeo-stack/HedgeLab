package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "corn_receipt_tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReceiptTicket extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String ticketRef; // e.g. RT-GM1-2025-001
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "physical_contract_id", nullable = false)
    private PhysicalContract physicalContract;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    private LocalDate receiptDate;
    @Column(precision = 12, scale = 4)
    private BigDecimal grossMt;
    @Column(precision = 12, scale = 4)
    private BigDecimal netMt; // after shrink/moisture
    @Column(precision = 6, scale = 2)
    private BigDecimal moisturePct;
    @Column(precision = 6, scale = 4)
    private BigDecimal shrinkFactor;
    @Column(precision = 12, scale = 4)
    private BigDecimal netBushels; // netMt * 39.3683
    @Column(precision = 10, scale = 4)
    private BigDecimal deliveredCostPerMt; // board + basis + freight
    @Column(precision = 14, scale = 2)
    private BigDecimal totalCostUsd;
    private String vehicleRef;
    private String notes;
}
