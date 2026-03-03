package com.hedgelab.v2.repository.trade;

import com.hedgelab.v2.entity.trade.FinancialTrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface FinancialTradeRepository extends JpaRepository<FinancialTrade, UUID> {

    @Query("SELECT t FROM FinancialTrade t WHERE t.orgId = :orgId" +
           " AND (:commodityId IS NULL OR t.commodityId = :commodityId)" +
           " AND (:status IS NULL OR t.status = :status)" +
           " AND (:contractMonth IS NULL OR t.contractMonth = :contractMonth)" +
           " AND (:dateFrom IS NULL OR t.tradeDate >= :dateFrom)" +
           " AND (:dateTo IS NULL OR t.tradeDate <= :dateTo)" +
           " ORDER BY t.tradeDate DESC, t.createdAt DESC")
    List<FinancialTrade> findFiltered(@Param("orgId") UUID orgId,
                                       @Param("commodityId") String commodityId,
                                       @Param("status") String status,
                                       @Param("contractMonth") String contractMonth,
                                       @Param("dateFrom") LocalDate dateFrom,
                                       @Param("dateTo") LocalDate dateTo);
}
