package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

/**
 * A single named cost component within a budget line.
 *
 * Examples:
 *   Board Price  | ¢/bu  | 435.00
 *   Basis        | ¢/bu  | -18.25
 *   Freight      | $/MT  |  15.00
 *   Elevation    | $/MT  |   3.50
 *   FX Premium   | $/MT  |   2.00
 *   Insurance    | %     |   0.25
 *
 * Units recognised for auto all-in conversion:
 *   "¢/bu"  → divided by 100 × 39.3683 bu/MT → $/MT
 *   "$/MT"  → included directly
 *   anything else → included directly (treated as $/MT)
 */
@Entity
@Table(name = "corn_budget_components")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CornBudgetComponent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "budget_line_id")
    private CornBudgetLine budgetLine;

    /** Human-readable label, e.g. "Board Price", "Basis", "Freight" */
    @Column(name = "component_name", nullable = false, length = 100)
    private String componentName;

    /** Unit string shown in the UI, e.g. "¢/bu", "$/MT", "CAD/MT", "%" */
    @Column(nullable = false, length = 20)
    private String unit;

    @Column(name = "target_value", nullable = false, precision = 12, scale = 4)
    private BigDecimal targetValue;

    /** Controls display order within a budget line */
    @Column(name = "display_order")
    private Integer displayOrder;
}
