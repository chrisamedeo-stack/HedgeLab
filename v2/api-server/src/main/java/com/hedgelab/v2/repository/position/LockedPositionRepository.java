package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.LockedPosition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LockedPositionRepository extends JpaRepository<LockedPosition, UUID> {
    Optional<LockedPosition> findByAllocationId(UUID allocationId);
    List<LockedPosition> findBySiteId(UUID siteId);
    List<LockedPosition> findBySiteIdAndCommodityId(UUID siteId, String commodityId);
}
