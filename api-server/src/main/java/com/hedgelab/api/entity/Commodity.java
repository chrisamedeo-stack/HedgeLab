package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "commodities", uniqueConstraints = @UniqueConstraint(name = "uq_commodity_code", columnNames = "code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Commodity extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "commodity_seq")
    @SequenceGenerator(name = "commodity_seq", sequenceName = "commodity_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "code", length = 30, nullable = false)
    private String code;

    @Column(name = "name", length = 100, nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 30, nullable = false)
    private CommodityCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "unit_of_measure", length = 20, nullable = false)
    private UnitOfMeasure unitOfMeasure;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Column(name = "hedgeable", nullable = false)
    @Builder.Default
    private boolean hedgeable = false;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "icis_code", length = 30)
    private String icisCode;

    // --- Contract spec fields ---

    @Column(name = "exchange", length = 20)
    private String exchange;

    @Column(name = "futures_prefix", length = 10)
    private String futuresPrefix;

    @Column(name = "contract_size_bu")
    private Integer contractSizeBu;

    @Column(name = "bushels_per_mt", precision = 10, scale = 4)
    private BigDecimal bushelsPerMt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "contract_months", columnDefinition = "jsonb")
    private List<String> contractMonths;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "month_mappings", columnDefinition = "jsonb")
    private Map<String, List<Integer>> monthMappings;

    @Column(name = "slug", length = 30)
    private String slug;
}
