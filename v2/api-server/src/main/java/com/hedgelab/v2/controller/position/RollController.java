package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.Allocation;
import com.hedgelab.v2.entity.position.Rollover;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/roll")
@RequiredArgsConstructor
public class RollController {

    private final PositionService positionService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Rollover execute(@RequestBody Map<String, Object> body) {
        UUID sourceAllocationId = UUID.fromString((String) body.get("sourceAllocationId"));
        BigDecimal closePrice = new BigDecimal(body.get("closePrice").toString());
        BigDecimal openPrice = new BigDecimal(body.get("openPrice").toString());
        String openMonth = (String) body.get("openMonth");
        BigDecimal openVolume = body.containsKey("openVolume") ? new BigDecimal(body.get("openVolume").toString()) : null;
        BigDecimal commission = body.containsKey("commission") ? new BigDecimal(body.get("commission").toString()) : null;
        BigDecimal fees = body.containsKey("fees") ? new BigDecimal(body.get("fees").toString()) : null;
        Boolean autoReallocate = (Boolean) body.get("autoReallocate");
        UUID reallocationSiteId = body.containsKey("reallocationSiteId") ? UUID.fromString((String) body.get("reallocationSiteId")) : null;
        String reallocationBudgetMonth = (String) body.get("reallocationBudgetMonth");
        String notes = (String) body.get("notes");
        UUID orgId = UUID.fromString((String) body.get("orgId"));
        UUID userId = UUID.fromString((String) body.get("userId"));

        return positionService.executeRoll(sourceAllocationId, closePrice, openPrice, openMonth,
                openVolume, commission, fees, autoReallocate, reallocationSiteId,
                reallocationBudgetMonth, notes, orgId, userId);
    }

    @GetMapping("/candidates")
    public List<Allocation> candidates(@RequestParam UUID orgId,
                                        @RequestParam(required = false) String commodityId) {
        return positionService.getRolloverCandidates(orgId, commodityId);
    }
}
