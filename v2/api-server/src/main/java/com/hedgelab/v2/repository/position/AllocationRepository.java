package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.Allocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface AllocationRepository extends JpaRepository<Allocation, UUID> {

    List<Allocation> findByOrgIdAndStatusNot(UUID orgId, String status);

    @Query("SELECT a FROM Allocation a WHERE a.orgId = :orgId" +
           " AND (:siteId IS NULL OR a.siteId = :siteId)" +
           " AND (:commodityId IS NULL OR a.commodityId = :commodityId)" +
           " AND (:status IS NULL OR a.status = :status)" +
           " AND (:contractMonth IS NULL OR a.contractMonth = :contractMonth)" +
           " AND (:budgetMonth IS NULL OR a.budgetMonth = :budgetMonth)" +
           " ORDER BY a.contractMonth, a.createdAt")
    List<Allocation> findFiltered(@Param("orgId") UUID orgId,
                                  @Param("siteId") UUID siteId,
                                  @Param("commodityId") String commodityId,
                                  @Param("status") String status,
                                  @Param("contractMonth") String contractMonth,
                                  @Param("budgetMonth") String budgetMonth);

    List<Allocation> findBySiteIdAndStatusNot(UUID siteId, String status);
    List<Allocation> findBySiteIdAndCommodityIdAndStatusNot(UUID siteId, String commodityId, String status);

    List<Allocation> findByTradeIdAndStatusNot(UUID tradeId, String status);

    @Query("SELECT COALESCE(SUM(a.allocatedVolume), 0) FROM Allocation a WHERE a.tradeId = :tradeId AND a.status <> 'cancelled'")
    java.math.BigDecimal sumAllocatedVolumeByTradeId(@Param("tradeId") UUID tradeId);

    @Query("SELECT a FROM Allocation a WHERE a.orgId = :orgId AND a.status = 'open'" +
           " AND (:commodityId IS NULL OR a.commodityId = :commodityId)" +
           " ORDER BY a.contractMonth, a.createdAt")
    List<Allocation> findOpenByOrgId(@Param("orgId") UUID orgId, @Param("commodityId") String commodityId);
}
