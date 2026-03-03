package com.hedgelab.v2.controller.position;

import com.hedgelab.v2.entity.position.PhysicalPosition;
import com.hedgelab.v2.service.position.PositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v2/positions/physicals")
@RequiredArgsConstructor
public class PhysicalController {

    private final PositionService positionService;

    @GetMapping
    public List<PhysicalPosition> list(@RequestParam(required = false) UUID orgId,
                                        @RequestParam(required = false) UUID siteId,
                                        @RequestParam(required = false) String commodityId,
                                        @RequestParam(required = false) String status) {
        return positionService.listPhysicals(orgId, siteId, commodityId, status);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PhysicalPosition create(@RequestBody PhysicalPosition pos) {
        return positionService.createPhysical(pos);
    }
}
