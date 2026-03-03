package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.Allocation;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/allocations")
@RequiredArgsConstructor
public class AllocationController {

    private final PositionService positionService;

    @GetMapping
    public List<Allocation> list(@RequestParam(required = false) UUID orgId,
                                  @RequestParam(required = false) UUID siteId,
                                  @RequestParam(required = false) String commodityId,
                                  @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String contractMonth,
                                  @RequestParam(required = false) String budgetMonth) {
        return positionService.listAllocations(orgId, siteId, commodityId, status, contractMonth, budgetMonth);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Allocation create(@RequestBody Allocation alloc) {
        return positionService.allocateToSite(alloc);
    }

    @GetMapping("/{id}")
    public Allocation get(@PathVariable UUID id) {
        return positionService.getAllocation(id);
    }

    @PatchMapping("/{id}")
    public Allocation update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        UUID userId = body.containsKey("userId") ? UUID.fromString((String) body.get("userId")) : null;
        String budgetMonth = (String) body.get("budgetMonth");
        String notes = (String) body.get("notes");
        UUID siteId = body.containsKey("siteId") ? UUID.fromString((String) body.get("siteId")) : null;
        return positionService.updateAllocation(id, userId, budgetMonth, notes, siteId);
    }

    @DeleteMapping("/{id}")
    public Allocation cancel(@PathVariable UUID id, @RequestParam String userId) {
        return positionService.cancelAllocation(id, UUID.fromString(userId));
    }
}
