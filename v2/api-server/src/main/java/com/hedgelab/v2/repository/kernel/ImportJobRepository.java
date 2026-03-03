package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.ImportJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ImportJobRepository extends JpaRepository<ImportJob, UUID> {
    List<ImportJob> findByOrgIdOrderByCreatedAtDesc(UUID orgId);
}
