package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.LockedPosition;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/efp")
@RequiredArgsConstructor
public class EfpController {

    private final PositionService positionService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LockedPosition execute(@RequestBody Map<String, Object> body) {
        UUID allocationId = UUID.fromString((String) body.get("allocationId"));
        BigDecimal lockPrice = new BigDecimal(body.get("lockPrice").toString());
        BigDecimal basisPrice = body.containsKey("basisPrice") ? new BigDecimal(body.get("basisPrice").toString()) : null;
        String deliveryMonth = (String) body.get("deliveryMonth");
        UUID userId = UUID.fromString((String) body.get("userId"));
        return positionService.executeEFP(allocationId, lockPrice, basisPrice, deliveryMonth, userId);
    }
}
