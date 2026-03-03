package com.hedgelab.v2.controller.budget;

import com.hedgelab.v2.entity.budget.BudgetPeriod;
import com.hedgelab.v2.service.budget.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/budget/periods/{periodId}")
@RequiredArgsConstructor
public class BudgetWorkflowController {

    private final BudgetService budgetService;

    @PostMapping("/submit")
    public BudgetPeriod submit(@PathVariable UUID periodId, @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        return budgetService.submitBudget(periodId, userId);
    }

    @PostMapping("/approve")
    public BudgetPeriod approve(@PathVariable UUID periodId, @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        return budgetService.approveBudget(periodId, userId);
    }

    @PostMapping("/lock")
    public BudgetPeriod lock(@PathVariable UUID periodId, @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        return budgetService.lockBudget(periodId, userId);
    }

    @PostMapping("/unlock")
    public BudgetPeriod unlock(@PathVariable UUID periodId, @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        return budgetService.unlockBudget(periodId, userId);
    }
}
