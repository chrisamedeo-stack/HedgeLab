package com.hedgelab.v2.dto.response;

import com.hedgelab.v2.entity.kernel.Site;
import com.hedgelab.v2.entity.kernel.SiteGroup;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class SiteGroupResponse {

    private UUID id;
    private String name;
    private String groupType;
    private Integer sortOrder;
    private Boolean isActive;
    private List<SiteSummary> sites;

    @Data
    @Builder
    public static class SiteSummary {
        private UUID id;
        private String name;
        private String code;
    }

    public static SiteGroupResponse from(SiteGroup group) {
        List<SiteSummary> siteSummaries = group.getSites().stream()
                .map(s -> SiteSummary.builder()
                        .id(s.getId())
                        .name(s.getName())
                        .code(s.getCode())
                        .build())
                .toList();

        return SiteGroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .groupType(group.getGroupType())
                .sortOrder(group.getSortOrder())
                .isActive(group.getIsActive())
                .sites(siteSummaries)
                .build();
    }
}
