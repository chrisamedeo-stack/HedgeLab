package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.Site;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SiteRepository extends JpaRepository<Site, UUID> {
    List<Site> findByOrgId(UUID orgId);
    List<Site> findByOrgIdAndRegion(UUID orgId, String region);
}
