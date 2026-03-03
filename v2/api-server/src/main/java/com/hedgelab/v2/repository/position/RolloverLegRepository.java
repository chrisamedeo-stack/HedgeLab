package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.RolloverLeg;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RolloverLegRepository extends JpaRepository<RolloverLeg, UUID> {
    List<RolloverLeg> findByRolloverId(UUID rolloverId);
}
