package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "formula_components")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FormulaComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "formula_comp_seq")
    @SequenceGenerator(name = "formula_comp_seq", sequenceName = "formula_comp_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "formula_id", nullable = false)
    private PriceFormula formula;

    @Column(name = "sequence_order", nullable = false)
    private Integer sequenceOrder;

    @Column(name = "component_label", length = 80, nullable = false)
    private String componentLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "component_type", length = 20, nullable = false)
    private PricingType componentType;

    @Column(name = "weight", precision = 10, scale = 6, nullable = false)
    private BigDecimal weight;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reference_index_id")
    private PriceIndex referenceIndex;

    @Column(name = "fixed_value", precision = 20, scale = 6)
    private BigDecimal fixedValue;

    @Column(name = "price_cap", precision = 20, scale = 6)
    private BigDecimal cap;

    @Column(name = "price_floor", precision = 20, scale = 6)
    private BigDecimal floor;
}
