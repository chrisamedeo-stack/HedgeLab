package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.Site;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SiteService {

    private final SiteRepository siteRepository;
    private final AuditService auditService;

    public List<Site> list(UUID orgId, String region) {
        if (region != null) {
            return siteRepository.findByOrgIdAndRegion(orgId, region);
        }
        return siteRepository.findByOrgId(orgId);
    }

    public Site getById(UUID id) {
        return siteRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Site", id));
    }

    public Site create(Site site) {
        Site saved = siteRepository.save(site);
        auditService.log(site.getOrgId(), null, "kernel", "site",
                saved.getId().toString(), "create", null, null, "api", null);
        return saved;
    }

    public Site update(UUID id, Site updates) {
        Site existing = getById(id);
        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getCode() != null) existing.setCode(updates.getCode());
        if (updates.getRegion() != null) existing.setRegion(updates.getRegion());
        if (updates.getTimezone() != null) existing.setTimezone(updates.getTimezone());
        if (updates.getIsActive() != null) existing.setIsActive(updates.getIsActive());
        if (updates.getConfig() != null) existing.setConfig(updates.getConfig());
        if (updates.getSiteTypeId() != null) existing.setSiteTypeId(updates.getSiteTypeId());
        return siteRepository.save(existing);
    }

    public void delete(UUID id) {
        siteRepository.deleteById(id);
    }
}
