package com.hedgelab.v2.entity.trade;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "tc_financial_trades")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FinancialTrade {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "trade_type", nullable = false, length = 20)
    @Builder.Default
    private String tradeType = "futures";

    @Column(nullable = false, length = 10)
    private String direction;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "open";

    @Column(name = "trade_date", nullable = false)
    private LocalDate tradeDate;

    @Column(name = "contract_month", nullable = false, length = 10)
    private String contractMonth;

    @Column(length = 200)
    private String broker;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "num_contracts", nullable = false)
    private Integer numContracts;

    @Column(name = "contract_size", nullable = false)
    private BigDecimal contractSize;

    // total_volume is GENERATED ALWAYS AS (num_contracts * contract_size) STORED
    @Column(name = "total_volume", insertable = false, updatable = false)
    private BigDecimal totalVolume;

    @Column(name = "trade_price", nullable = false)
    private BigDecimal tradePrice;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Builder.Default
    private BigDecimal commission = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal fees = BigDecimal.ZERO;

    @Column(name = "allocated_volume")
    @Builder.Default
    private BigDecimal allocatedVolume = BigDecimal.ZERO;

    // unallocated_volume is GENERATED ALWAYS STORED
    @Column(name = "unallocated_volume", insertable = false, updatable = false)
    private BigDecimal unallocatedVolume;

    @Column(name = "option_type", length = 10)
    private String optionType;

    @Column(name = "strike_price")
    private BigDecimal strikePrice;

    private BigDecimal premium;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "rolled_from_id")
    private UUID rolledFromId;

    @Column(name = "roll_id")
    private UUID rollId;

    @Column(name = "entered_by")
    @JsonAlias("userId")
    private UUID enteredBy;

    @Column(name = "external_ref", length = 100)
    private String externalRef;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "import_job_id")
    private UUID importJobId;

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Transient
    private String commodityName;
}
