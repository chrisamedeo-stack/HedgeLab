package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.CoverageResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.CoverageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/coverage")
@RequiredArgsConstructor
public class CoverageController {
    private final CoverageService service;
    private final CommoditySpecService specService;

    @GetMapping
    public List<CoverageResponse> getCoverage(@PathVariable String commodity) {
        String code = specService.resolveSlug(commodity);
        return service.getCoverage(code);
    }
}
