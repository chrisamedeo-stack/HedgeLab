package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.OrgSetting;
import com.hedgelab.v2.service.kernel.OrgSettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/org-settings")
@RequiredArgsConstructor
public class OrgSettingsController {

    private final OrgSettingsService orgSettingsService;

    @GetMapping
    public OrgSetting get(@RequestParam UUID orgId) {
        return orgSettingsService.get(orgId);
    }

    @PatchMapping
    public OrgSetting update(@RequestBody OrgSetting settings) {
        return orgSettingsService.update(settings.getOrgId(), settings);
    }
}
