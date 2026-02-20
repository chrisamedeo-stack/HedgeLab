package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "price_formulas", uniqueConstraints = @UniqueConstraint(name = "uq_formula_code", columnNames = "formula_code"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class PriceFormula extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "formula_seq")
    @SequenceGenerator(name = "formula_seq", sequenceName = "formula_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "formula_code", length = 30, nullable = false)
    private String formulaCode;

    @Column(name = "display_name", length = 100, nullable = false)
    private String displayName;

    @Column(name = "description", length = 500)
    private String description;

    @Column(name = "active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @OneToMany(mappedBy = "formula", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("sequenceOrder ASC")
    @Builder.Default
    private List<FormulaComponent> components = new ArrayList<>();
}
