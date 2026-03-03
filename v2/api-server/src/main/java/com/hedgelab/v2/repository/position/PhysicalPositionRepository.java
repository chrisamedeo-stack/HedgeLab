package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.PhysicalPosition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PhysicalPositionRepository extends JpaRepository<PhysicalPosition, UUID> {

    @Query("SELECT p FROM PhysicalPosition p WHERE 1=1" +
           " AND (:orgId IS NULL OR p.orgId = :orgId)" +
           " AND (:siteId IS NULL OR p.siteId = :siteId)" +
           " AND (:commodityId IS NULL OR p.commodityId = :commodityId)" +
           " AND (:status IS NULL OR p.status = :status)" +
           " ORDER BY p.deliveryMonth, p.createdAt")
    List<PhysicalPosition> findFiltered(@Param("orgId") UUID orgId,
                                         @Param("siteId") UUID siteId,
                                         @Param("commodityId") String commodityId,
                                         @Param("status") String status);

    List<PhysicalPosition> findBySiteIdAndStatusNot(UUID siteId, String status);
    List<PhysicalPosition> findBySiteIdAndCommodityIdAndStatusNot(UUID siteId, String commodityId, String status);
}
