package com.hedgelab.v2.repository.position;

import com.hedgelab.v2.entity.position.Rollover;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RolloverRepository extends JpaRepository<Rollover, UUID> {
}
