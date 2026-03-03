package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.SiteGroup;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SiteGroupRepository extends JpaRepository<SiteGroup, UUID> {

    @EntityGraph(attributePaths = "sites")
    List<SiteGroup> findByOrgId(UUID orgId);

    @EntityGraph(attributePaths = "sites")
    List<SiteGroup> findByOrgIdAndGroupType(UUID orgId, String groupType);
}
