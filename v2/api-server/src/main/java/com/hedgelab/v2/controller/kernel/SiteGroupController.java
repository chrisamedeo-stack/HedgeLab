package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.dto.response.SiteGroupResponse;
import com.hedgelab.v2.entity.kernel.SiteGroup;
import com.hedgelab.v2.service.kernel.SiteGroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/site-groups")
@RequiredArgsConstructor
public class SiteGroupController {

    private final SiteGroupService siteGroupService;

    @GetMapping
    public List<SiteGroupResponse> list(@RequestParam UUID orgId, @RequestParam(required = false) String type) {
        return siteGroupService.list(orgId, type);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SiteGroup create(@RequestBody SiteGroup group) {
        return siteGroupService.create(group);
    }

    @PutMapping("/{id}")
    public SiteGroup update(@PathVariable UUID id, @RequestBody SiteGroup group) {
        return siteGroupService.update(id, group);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        siteGroupService.delete(id);
    }
}
