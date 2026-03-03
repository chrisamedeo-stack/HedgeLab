package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.PricingFormula;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PricingFormulaRepository extends JpaRepository<PricingFormula, UUID> {

    @Query("SELECT f FROM PricingFormula f WHERE f.orgId = :orgId AND f.isActive = true ORDER BY f.isSystem DESC, f.name")
    List<PricingFormula> findActiveByOrgId(@Param("orgId") UUID orgId);

    @Query("SELECT f FROM PricingFormula f WHERE f.orgId = :orgId AND f.isActive = true AND (f.commodityId = :commodityId OR f.commodityId IS NULL) ORDER BY f.isSystem DESC, f.name")
    List<PricingFormula> findActiveByOrgIdAndCommodityId(@Param("orgId") UUID orgId, @Param("commodityId") String commodityId);
}
