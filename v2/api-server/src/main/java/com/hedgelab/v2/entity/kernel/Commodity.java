package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;

@Entity
@Table(name = "commodities")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Commodity {

    @Id
    @Column(length = 20)
    private String id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 20)
    @Builder.Default
    private String category = "ag";

    @Column(nullable = false, length = 20)
    private String unit;

    @Column(length = 3)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "contract_size")
    private BigDecimal contractSize;

    @Column(name = "tick_size")
    private BigDecimal tickSize;

    @Column(name = "tick_value")
    private BigDecimal tickValue;

    @Column(length = 20)
    private String exchange;

    @Column(name = "contract_months", length = 24)
    private String contractMonths;

    @Column(name = "decimal_places")
    @Builder.Default
    private Integer decimalPlaces = 2;

    @Column(name = "is_active")
    @Builder.Default
    private Boolean isActive = true;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> config = Map.of();

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
