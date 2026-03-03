package com.hedgelab.v2.controller.budget;

import com.hedgelab.v2.service.budget.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/budget/coverage")
@RequiredArgsConstructor
public class CoverageController {

    private final BudgetService budgetService;

    @GetMapping
    public Map<String, Object> get(@RequestParam UUID orgId,
                                    @RequestParam(required = false) String commodityId,
                                    @RequestParam(required = false) String siteId) {
        return budgetService.getCoverageSummary(orgId, commodityId, siteId);
    }
}
