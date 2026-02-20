package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.SiteResponse;
import com.hedgelab.api.service.SiteService;
import lombok.RequiredArgsConstructor;
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
}
