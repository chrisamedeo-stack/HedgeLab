package com.hedgelab.v2.entity.kernel;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "org_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OrgSetting {

    @Id
    @Column(name = "org_id")
    private UUID orgId;

    @Column(name = "default_currency", length = 3)
    @Builder.Default
    private String defaultCurrency = "USD";

    @Column(name = "reporting_currency", length = 3)
    @Builder.Default
    private String reportingCurrency = "USD";

    @Column(name = "fiscal_year_start")
    @Builder.Default
    private Integer fiscalYearStart = 1;

    @Column(name = "date_format", length = 20)
    @Builder.Default
    private String dateFormat = "MM/DD/YYYY";

    @Column(name = "number_format", length = 20)
    @Builder.Default
    private String numberFormat = "1,000.00";

    @Column(length = 50)
    @Builder.Default
    private String timezone = "America/Chicago";

    @Column(name = "default_exchange", length = 20)
    @Builder.Default
    private String defaultExchange = "CBOT";

    @Column(name = "default_broker", length = 200)
    private String defaultBroker;

    @Column(name = "default_account", length = 50)
    private String defaultAccount;

    @Column(name = "commission_default")
    @Builder.Default
    private BigDecimal commissionDefault = BigDecimal.ZERO;

    @Column(name = "budget_lock_after_approval")
    @Builder.Default
    private Boolean budgetLockAfterApproval = false;

    @Column(name = "budget_variance_threshold")
    @Builder.Default
    private BigDecimal budgetVarianceThreshold = BigDecimal.TEN;

    @Column(name = "mtm_auto_run")
    @Builder.Default
    private Boolean mtmAutoRun = true;

    @Column(name = "mtm_run_time")
    private LocalTime mtmRunTime;

    @Column(name = "position_limit_hard_block")
    @Builder.Default
    private Boolean positionLimitHardBlock = false;

    @Column(name = "import_require_approval")
    @Builder.Default
    private Boolean importRequireApproval = true;

    @Column(name = "import_auto_template")
    @Builder.Default
    private Boolean importAutoTemplate = true;

    @Column(name = "notifications_enabled")
    @Builder.Default
    private Boolean notificationsEnabled = true;

    @Column(name = "email_notifications")
    @Builder.Default
    private Boolean emailNotifications = true;

    @Column(name = "roll_critical_days")
    @Builder.Default
    private Integer rollCriticalDays = 3;

    @Column(name = "roll_urgent_days")
    @Builder.Default
    private Integer rollUrgentDays = 7;

    @Column(name = "roll_upcoming_days")
    @Builder.Default
    private Integer rollUpcomingDays = 21;

    @Column(name = "roll_auto_notify")
    @Builder.Default
    private Boolean rollAutoNotify = true;

    @Column(name = "roll_require_approval_critical")
    @Builder.Default
    private Boolean rollRequireApprovalCritical = true;

    @Column(name = "roll_default_target", length = 20)
    @Builder.Default
    private String rollDefaultTarget = "next_active";

    @Column(name = "roll_budget_month_policy", length = 20)
    @Builder.Default
    private String rollBudgetMonthPolicy = "keep_original";

    @Column(name = "roll_cost_allocation", length = 20)
    @Builder.Default
    private String rollCostAllocation = "site";

    @Column(name = "created_at", updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    @Builder.Default
    private Instant updatedAt = Instant.now();
}
