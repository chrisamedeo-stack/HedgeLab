package com.hedgelab.v2.controller.budget;

import com.hedgelab.v2.entity.budget.BudgetPeriod;
import com.hedgelab.v2.service.budget.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/budget/periods")
@RequiredArgsConstructor
public class BudgetPeriodController {

    private final BudgetService budgetService;

    @GetMapping
    public List<BudgetPeriod> list(@RequestParam UUID orgId,
                                    @RequestParam(required = false) UUID siteId,
                                    @RequestParam(required = false) String commodityId,
                                    @RequestParam(required = false) Integer budgetYear,
                                    @RequestParam(required = false) String status) {
        return budgetService.listPeriods(orgId, siteId, commodityId, budgetYear, status);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BudgetPeriod create(@RequestBody BudgetPeriod period) {
        return budgetService.createPeriod(period);
    }

    @GetMapping("/{periodId}")
    public BudgetPeriod get(@PathVariable UUID periodId) {
        return budgetService.getPeriod(periodId);
    }

    @PutMapping("/{periodId}")
    public BudgetPeriod update(@PathVariable UUID periodId, @RequestBody Map<String, Object> body) {
        String notes = (String) body.get("notes");
        return budgetService.updatePeriodNotes(periodId, notes);
    }
}
