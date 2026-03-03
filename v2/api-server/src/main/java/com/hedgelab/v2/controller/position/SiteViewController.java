package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/site-view")
@RequiredArgsConstructor
public class SiteViewController {

    private final PositionService positionService;

    @GetMapping("/{siteId}")
    public Map<String, Object> get(@PathVariable UUID siteId,
                                    @RequestParam(required = false) String commodityId) {
        return positionService.getSitePosition(siteId, commodityId);
    }
}
