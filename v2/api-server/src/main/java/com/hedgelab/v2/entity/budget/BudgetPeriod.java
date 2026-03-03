package com.hedgelab.v2.entity.budget;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "bgt_periods", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"site_id", "commodity_id", "budget_year"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BudgetPeriod {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "org_id", nullable = false)
    private UUID orgId;

    @Column(name = "site_id", nullable = false)
    private UUID siteId;

    @Column(name = "commodity_id", nullable = false, length = 20)
    private String commodityId;

    @Column(name = "budget_year", nullable = false)
    private Integer budgetYear;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "draft";

    @Column(name = "approved_by")
    private UUID approvedBy;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "import_job_id")
    private UUID importJobId;

    @Column(nullable = false, length = 10)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @Transient
    @Builder.Default
    private List<BudgetLineItem> lineItems = new ArrayList<>();

    // Transient joined fields
    @Transient
    private String siteName;
    @Transient
    private String siteCode;
    @Transient
    private String commodityName;
}
