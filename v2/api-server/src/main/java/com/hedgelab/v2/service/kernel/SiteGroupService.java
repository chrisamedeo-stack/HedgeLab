package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.dto.response.SiteGroupResponse;
import com.hedgelab.v2.entity.kernel.SiteGroup;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.SiteGroupRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SiteGroupService {

    private final SiteGroupRepository siteGroupRepository;

    @Transactional(readOnly = true)
    public List<SiteGroupResponse> list(UUID orgId, String groupType) {
        List<SiteGroup> groups;
        if (groupType != null) {
            groups = siteGroupRepository.findByOrgIdAndGroupType(orgId, groupType);
        } else {
            groups = siteGroupRepository.findByOrgId(orgId);
        }
        return groups.stream().map(SiteGroupResponse::from).toList();
    }

    public SiteGroup getById(UUID id) {
        return siteGroupRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("SiteGroup", id));
    }

    public SiteGroup create(SiteGroup group) {
        return siteGroupRepository.save(group);
    }

    public SiteGroup update(UUID id, SiteGroup updates) {
        SiteGroup existing = getById(id);
        if (updates.getName() != null) existing.setName(updates.getName());
        if (updates.getGroupType() != null) existing.setGroupType(updates.getGroupType());
        if (updates.getSortOrder() != null) existing.setSortOrder(updates.getSortOrder());
        if (updates.getIsActive() != null) existing.setIsActive(updates.getIsActive());
        return siteGroupRepository.save(existing);
    }

    public void delete(UUID id) {
        siteGroupRepository.deleteById(id);
    }
}
