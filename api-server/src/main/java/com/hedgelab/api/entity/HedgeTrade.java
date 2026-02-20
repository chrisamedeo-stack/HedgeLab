package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "corn_hedge_trades")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HedgeTrade extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(unique = true, nullable = false)
    private String tradeRef; // e.g. HT-2025-001
    private String futuresMonth; // e.g. ZCH25, ZCK25, ZCN25, ZCU25, ZCZ25
    private Integer lots; // number of CBOT lots (1 lot = 5000 bushels)
    @Column(precision = 10, scale = 4)
    private BigDecimal pricePerBushel; // USD/bushel entry price
    private String brokerAccount; // e.g. StoneX
    private LocalDate tradeDate;
    @Enumerated(EnumType.STRING)
    private HedgeTradeStatus status;
    private Integer openLots; // lots not yet EFP'd
    private String notes;
    /** Hedge book: CANADA or US */
    @Column(length = 10)
    private String book;
}
