package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.CoverageResponse;
import com.hedgelab.api.service.CoverageService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/coverage")
@RequiredArgsConstructor
public class CoverageController {
    private final CoverageService service;

    @GetMapping
    public List<CoverageResponse> getCoverage() {
        return service.getCoverage();
    }
}
