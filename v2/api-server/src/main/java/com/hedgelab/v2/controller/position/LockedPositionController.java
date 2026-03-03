package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.LockedPosition;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/locked")
@RequiredArgsConstructor
public class LockedPositionController {

    private final PositionService positionService;

    @GetMapping
    public List<LockedPosition> list(@RequestParam(required = false) UUID siteId,
                                      @RequestParam(required = false) String commodityId) {
        return positionService.listLocked(siteId, commodityId);
    }
}
