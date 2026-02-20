package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateSiteRequest;
import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.service.SiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/sites")
@RequiredArgsConstructor
public class SiteController {
    private final SiteService siteService;

    @GetMapping
    public List<SiteResponse> getSites() {
        return siteService.getAllSites();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SiteResponse create(@Valid @RequestBody CreateSiteRequest req) {
        return siteService.create(req);
    }

    @PutMapping("/{id}")
    public SiteResponse update(@PathVariable Long id, @Valid @RequestBody CreateSiteRequest req) {
        return siteService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        siteService.delete(id);
    }
}
