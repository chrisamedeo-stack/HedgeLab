package com.hedgelab.api.repository;

import com.hedgelab.api.entity.HedgeAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface HedgeAllocationRepository extends JpaRepository<HedgeAllocation, Long> {

    List<HedgeAllocation> findByHedgeTrade_IdOrderByBudgetMonthAsc(Long hedgeTradeId);

    List<HedgeAllocation> findBySite_CodeOrderByBudgetMonthAsc(String siteCode);

    List<HedgeAllocation> findBySite_CodeAndBudgetMonth(String siteCode, String budgetMonth);

    @Query("SELECT COALESCE(SUM(a.allocatedLots), 0) FROM HedgeAllocation a WHERE a.hedgeTrade.id = :tradeId")
    int sumAllocatedLotsByTradeId(@Param("tradeId") Long tradeId);

    @Query("SELECT a.hedgeTrade.id, COALESCE(SUM(a.allocatedLots), 0) " +
           "FROM HedgeAllocation a WHERE a.hedgeTrade.id IN :tradeIds GROUP BY a.hedgeTrade.id")
    List<Object[]> sumAllocatedLotsByTradeIds(@Param("tradeIds") List<Long> tradeIds);

    // Month-only allocations for a trade (site IS NULL)
    List<HedgeAllocation> findByHedgeTrade_IdAndSiteIsNullOrderByBudgetMonthAsc(Long hedgeTradeId);

    // Site-assigned allocations for a trade (site IS NOT NULL)
    List<HedgeAllocation> findByHedgeTrade_IdAndSiteIsNotNullOrderByBudgetMonthAsc(Long hedgeTradeId);

    // Find a specific month-only allocation
    Optional<HedgeAllocation> findByHedgeTrade_IdAndBudgetMonthAndSiteIsNull(Long hedgeTradeId, String budgetMonth);
}
