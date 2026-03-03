package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.RolloverCost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RolloverCostRepository extends JpaRepository<RolloverCost, UUID> {
    List<RolloverCost> findByRolloverId(UUID rolloverId);
}
