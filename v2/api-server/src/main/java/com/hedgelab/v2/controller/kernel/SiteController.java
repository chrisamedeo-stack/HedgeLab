package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.Site;
import com.hedgelab.v2.service.kernel.SiteService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/kernel/sites")
@RequiredArgsConstructor
public class SiteController {

    private final SiteService siteService;

    @GetMapping
    public List<Site> list(@RequestParam UUID orgId, @RequestParam(required = false) String region) {
        return siteService.list(orgId, region);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Site create(@RequestBody Site site) {
        return siteService.create(site);
    }

    @PutMapping("/{id}")
    public Site update(@PathVariable UUID id, @RequestBody Site site) {
        return siteService.update(id, site);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        siteService.delete(id);
    }
}
