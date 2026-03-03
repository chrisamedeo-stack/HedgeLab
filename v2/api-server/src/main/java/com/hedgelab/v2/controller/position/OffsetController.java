package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.Allocation;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/offset")
@RequiredArgsConstructor
public class OffsetController {

    private final PositionService positionService;

    @PostMapping
    public Allocation execute(@RequestBody Map<String, Object> body) {
        UUID allocationId = UUID.fromString((String) body.get("allocationId"));
        BigDecimal offsetPrice = new BigDecimal(body.get("offsetPrice").toString());
        UUID userId = UUID.fromString((String) body.get("userId"));
        return positionService.executeOffset(allocationId, offsetPrice, userId);
    }
}
