package com.hedgelab.v2.repository.budget;

import com.hedgelab.v2.entity.budget.BudgetPeriod;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface BudgetPeriodRepository extends JpaRepository<BudgetPeriod, UUID> {

    @Query("SELECT p FROM BudgetPeriod p WHERE p.orgId = :orgId" +
           " AND (:siteId IS NULL OR p.siteId = :siteId)" +
           " AND (:commodityId IS NULL OR p.commodityId = :commodityId)" +
           " AND (:budgetYear IS NULL OR p.budgetYear = :budgetYear)" +
           " AND (:status IS NULL OR p.status = :status)" +
           " ORDER BY p.budgetYear DESC")
    List<BudgetPeriod> findFiltered(@Param("orgId") UUID orgId,
                                     @Param("siteId") UUID siteId,
                                     @Param("commodityId") String commodityId,
                                     @Param("budgetYear") Integer budgetYear,
                                     @Param("status") String status);
}
