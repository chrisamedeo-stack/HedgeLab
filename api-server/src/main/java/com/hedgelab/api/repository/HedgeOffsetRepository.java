package com.hedgelab.api.repository;

import com.hedgelab.api.entity.HedgeOffset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface HedgeOffsetRepository extends JpaRepository<HedgeOffset, Long> {

    List<HedgeOffset> findByHedgeTrade_IdOrderByOffsetDateDesc(Long hedgeTradeId);

    List<HedgeOffset> findBySite_CodeOrderByOffsetDateDesc(String siteCode);

    List<HedgeOffset> findByHedgeTrade_BookOrderByOffsetDateDesc(String book);

    @Query("SELECT COALESCE(SUM(o.lots), 0) FROM HedgeOffset o WHERE o.hedgeTrade.id = :tradeId")
    int sumOffsetLotsByTradeId(@Param("tradeId") Long tradeId);

    @Query("SELECT COALESCE(SUM(o.lots), 0) FROM HedgeOffset o WHERE o.allocation.id = :allocationId")
    int sumOffsetLotsByAllocationId(@Param("allocationId") Long allocationId);
}
