package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/hedge-book")
@RequiredArgsConstructor
public class HedgeBookController {

    private final PositionService positionService;

    @GetMapping
    public Map<String, Object> get(@RequestParam UUID orgId,
                                    @RequestParam(required = false) String commodityId,
                                    @RequestParam(required = false) UUID regionGroupId) {
        return positionService.getHedgeBook(orgId, commodityId, regionGroupId);
    }
}
