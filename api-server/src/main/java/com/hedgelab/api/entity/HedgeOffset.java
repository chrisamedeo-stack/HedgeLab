package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Instant;

@Entity
@Table(name = "corn_hedge_offsets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HedgeOffset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hedge_trade_id", nullable = false)
    private HedgeTrade hedgeTrade;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id")
    private Site site;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "allocation_id")
    private HedgeAllocation allocation;

    @Column(nullable = false)
    private Integer lots;

    @Column(name = "exit_price", nullable = false, precision = 10, scale = 4)
    private BigDecimal exitPrice;

    @Column(name = "offset_date", nullable = false)
    private LocalDate offsetDate;

    @Column(name = "realized_pnl", precision = 12, scale = 2)
    private BigDecimal realizedPnl;

    private String notes;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
