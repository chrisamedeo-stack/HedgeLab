package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

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
}
