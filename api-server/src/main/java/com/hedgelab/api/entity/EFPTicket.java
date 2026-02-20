package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "corn_efp_tickets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EFPTicket extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String ticketRef; // e.g. EFP-2025-001
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "hedge_trade_id", nullable = false)
    private HedgeTrade hedgeTrade;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "physical_contract_id", nullable = false)
    private PhysicalContract physicalContract;
    private Integer lots; // futures lots exchanged
    private String futuresMonth; // e.g. ZCH25
    @Column(precision = 10, scale = 4)
    private BigDecimal boardPrice; // USD/bushel locked board price
    @Column(precision = 10, scale = 4)
    private BigDecimal basisValue; // USD/MT
    @Column(precision = 10, scale = 4)
    private BigDecimal quantityMt; // MT covered by this EFP (lots * 5000 / 39.3683)
    private LocalDate efpDate;
    private String confirmationRef; // broker confirmation number
    @Enumerated(EnumType.STRING)
    private EFPTicketStatus status;
    private String notes;

    @Column(name = "entry_price", precision = 10, scale = 4)
    private BigDecimal entryPrice;
}
