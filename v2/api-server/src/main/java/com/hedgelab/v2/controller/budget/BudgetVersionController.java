package com.hedgelab.v2.controller.budget;

import com.hedgelab.v2.entity.budget.BudgetLineItem;
import com.hedgelab.v2.entity.budget.BudgetVersion;
import com.hedgelab.v2.service.budget.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/budget/periods/{periodId}/versions")
@RequiredArgsConstructor
public class BudgetVersionController {

    private final BudgetService budgetService;

    @GetMapping
    public List<BudgetVersion> list(@PathVariable UUID periodId) {
        return budgetService.getVersionHistory(periodId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BudgetVersion create(@PathVariable UUID periodId, @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        String name = body.get("name");
        return budgetService.createVersionSnapshot(periodId, userId, name);
    }

    @PostMapping("/{versionNumber}/restore")
    public List<BudgetLineItem> restore(@PathVariable UUID periodId,
                                         @PathVariable int versionNumber,
                                         @RequestBody Map<String, String> body) {
        UUID userId = UUID.fromString(body.get("userId"));
        return budgetService.restoreVersion(periodId, versionNumber, userId);
    }
}
