package com.hedgelab.v2.controller.budget;

import com.hedgelab.v2.entity.budget.BudgetLineItem;
import com.hedgelab.v2.service.budget.BudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/budget/periods/{periodId}/line-items")
@RequiredArgsConstructor
public class BudgetLineItemController {

    private final BudgetService budgetService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public Object upsert(@PathVariable UUID periodId, @RequestBody Map<String, Object> body) {
        UUID userId = body.containsKey("userId") ? UUID.fromString((String) body.get("userId")) : null;

        // Bulk upsert
        if (body.containsKey("items")) {
            List<BudgetLineItem> items = ((List<Map<String, Object>>) body.get("items")).stream()
                    .map(this::toLineItem)
                    .toList();
            return budgetService.upsertLineItems(periodId, items, userId);
        }

        // Single upsert
        BudgetLineItem item = toLineItem(body);
        return budgetService.upsertLineItem(periodId, item, userId);
    }

    @DeleteMapping("/{lineItemId}")
    public Map<String, Boolean> delete(@PathVariable UUID periodId,
                                        @PathVariable UUID lineItemId,
                                        @RequestParam(required = false) String userId) {
        UUID uid = userId != null ? UUID.fromString(userId) : null;
        budgetService.deleteLineItem(lineItemId, uid);
        return Map.of("ok", true);
    }

    private BudgetLineItem toLineItem(Map<String, Object> map) {
        BudgetLineItem.BudgetLineItemBuilder b = BudgetLineItem.builder();
        if (map.containsKey("budgetMonth")) b.budgetMonth((String) map.get("budgetMonth"));
        if (map.containsKey("budgetedVolume")) b.budgetedVolume(toBd(map.get("budgetedVolume")));
        if (map.containsKey("budgetPrice")) b.budgetPrice(toBd(map.get("budgetPrice")));
        if (map.containsKey("committedVolume")) b.committedVolume(toBd(map.get("committedVolume")));
        if (map.containsKey("committedAvgPrice")) b.committedAvgPrice(toBd(map.get("committedAvgPrice")));
        if (map.containsKey("committedCost")) b.committedCost(toBd(map.get("committedCost")));
        if (map.containsKey("hedgedVolume")) b.hedgedVolume(toBd(map.get("hedgedVolume")));
        if (map.containsKey("hedgedAvgPrice")) b.hedgedAvgPrice(toBd(map.get("hedgedAvgPrice")));
        if (map.containsKey("hedgedCost")) b.hedgedCost(toBd(map.get("hedgedCost")));
        if (map.containsKey("forecastVolume")) b.forecastVolume(toBd(map.get("forecastVolume")));
        if (map.containsKey("forecastPrice")) b.forecastPrice(toBd(map.get("forecastPrice")));
        if (map.containsKey("notes")) b.notes((String) map.get("notes"));
        return b.build();
    }

    private java.math.BigDecimal toBd(Object val) {
        if (val == null) return null;
        return new java.math.BigDecimal(val.toString());
    }
}
