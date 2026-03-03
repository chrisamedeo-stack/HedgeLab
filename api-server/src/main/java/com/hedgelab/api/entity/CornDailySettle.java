package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Stores manually published daily settle prices per ZC futures month.
 * The latest record per futuresMonth is used for MTM calculations.
 */
@Entity
@Table(name = "corn_daily_settles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CornDailySettle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "futures_month", nullable = false, length = 10)
    private String futuresMonth;   // e.g. ZCN26

    @Column(name = "settle_date", nullable = false)
    private LocalDate settleDate;

    @Column(name = "price_per_bushel", nullable = false, precision = 10, scale = 4)
    private BigDecimal pricePerBushel;  // $/bushel
}
