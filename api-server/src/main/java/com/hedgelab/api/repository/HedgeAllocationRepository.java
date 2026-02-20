package com.hedgelab.api.repository;

import com.hedgelab.api.entity.HedgeAllocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface HedgeAllocationRepository extends JpaRepository<HedgeAllocation, Long> {

    List<HedgeAllocation> findByHedgeTrade_IdOrderByBudgetMonthAsc(Long hedgeTradeId);

    List<HedgeAllocation> findBySite_CodeOrderByBudgetMonthAsc(String siteCode);

    List<HedgeAllocation> findBySite_CodeAndBudgetMonth(String siteCode, String budgetMonth);

    @Query("SELECT COALESCE(SUM(a.allocatedLots), 0) FROM HedgeAllocation a WHERE a.hedgeTrade.id = :tradeId")
    int sumAllocatedLotsByTradeId(@Param("tradeId") Long tradeId);
}
