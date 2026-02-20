package com.hedgelab.api.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "corn_site_budgets", uniqueConstraints = @UniqueConstraint(columnNames = {"site_id", "delivery_month"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SiteBudget extends AuditableEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "site_id", nullable = false)
    private Site site;
    @Column(name = "delivery_month", nullable = false)
    private String deliveryMonth; // YYYY-MM
    @Column(precision = 12, scale = 4)
    private BigDecimal budgetVolumeMt; // budgeted metric tonnes
    @Column(precision = 10, scale = 4)
    private BigDecimal budgetPricePerMt; // USD/MT
    @Column(precision = 10, scale = 4)
    private BigDecimal budgetBasisPerMt;
}
