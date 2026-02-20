package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * One budget line = one site × commodity × delivery month target.
 * Cost components (basis, freight, elevation, etc.) are stored in
 * CornBudgetComponent and can be freely added or removed.
 */
@Entity
@Table(name = "corn_budget_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CornBudgetLine extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "site_id")
    private Site site;

    /** e.g. "CORN-ZC", "CORN" */
    @Column(name = "commodity_code", nullable = false, length = 20)
    private String commodityCode;

    /** Delivery / consumption month YYYY-MM */
    @Column(name = "budget_month", nullable = false, length = 7)
    private String budgetMonth;

    /**
     * Reference CBOT futures month used for pricing this delivery month.
     * e.g. "ZCN26" covers May/Jun deliveries.
     */
    @Column(name = "futures_month", length = 10)
    private String futuresMonth;

    /** Total budgeted volume in metric tonnes */
    @Column(name = "budget_volume_mt", precision = 14, scale = 4)
    private BigDecimal budgetVolumeMt;

    /** Budgeted volume in bushels (primary input; MT is derived) */
    @Column(name = "budget_volume_bu", precision = 16, scale = 2)
    private BigDecimal budgetVolumeBu;

    /**
     * Crop year label for grouping, e.g. "2025/2026".
     * Derived from budgetMonth but stored for fast filtering.
     */
    @Column(name = "crop_year", length = 10)
    private String cropYear;

    @Column(length = 500)
    private String notes;

    /** Ordered list of cost components (board price, basis, freight, etc.) */
    @OneToMany(mappedBy = "budgetLine", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("displayOrder ASC")
    @Builder.Default
    private List<CornBudgetComponent> components = new ArrayList<>();
}
