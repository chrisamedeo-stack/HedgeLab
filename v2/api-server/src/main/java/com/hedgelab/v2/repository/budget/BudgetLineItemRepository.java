package com.hedgelab.v2.repository.budget;

import com.hedgelab.v2.entity.budget.BudgetLineItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BudgetLineItemRepository extends JpaRepository<BudgetLineItem, UUID> {

    List<BudgetLineItem> findByPeriodIdOrderByBudgetMonth(UUID periodId);

    Optional<BudgetLineItem> findByPeriodIdAndBudgetMonth(UUID periodId, String budgetMonth);

    void deleteByPeriodId(UUID periodId);

    @Query(value = "SELECT li.budget_month," +
           " SUM(li.budgeted_volume) as budgeted," +
           " SUM(li.committed_volume) as committed," +
           " SUM(li.hedged_volume) as hedged," +
           " SUM(GREATEST(li.budgeted_volume - li.committed_volume - li.hedged_volume, 0)) as open_vol" +
           " FROM bgt_line_items li" +
           " JOIN bgt_periods p ON p.id = li.period_id" +
           " WHERE p.org_id = :orgId" +
           " AND (:commodityId IS NULL OR CAST(p.commodity_id AS VARCHAR) = :commodityId)" +
           " AND (:siteId IS NULL OR CAST(p.site_id AS VARCHAR) = :siteId)" +
           " GROUP BY li.budget_month" +
           " ORDER BY li.budget_month", nativeQuery = true)
    List<Object[]> getCoverageSummary(@Param("orgId") UUID orgId,
                                       @Param("commodityId") String commodityId,
                                       @Param("siteId") String siteId);
}
