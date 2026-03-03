package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.AssignSiteRequest;
import com.hedgelab.api.dto.request.CreateHedgeAllocationRequest;
import com.hedgelab.api.dto.response.HedgeAllocationResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.HedgeAllocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/hedges")
@RequiredArgsConstructor
public class HedgeAllocationController {

    private final HedgeAllocationService service;
    private final CommoditySpecService specService;

    @GetMapping("/{id}/allocations")
    public List<HedgeAllocationResponse> getAllocations(@PathVariable String commodity,
                                                         @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return service.getAllocationsForTrade(id);
    }

    @PostMapping("/{id}/allocations")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeAllocationResponse create(@PathVariable String commodity,
                                           @PathVariable Long id,
                                           @RequestBody CreateHedgeAllocationRequest req) {
        specService.resolveSlug(commodity);
        return service.create(id, req);
    }

    @PostMapping("/allocations/{id}/assign-site")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeAllocationResponse assignSite(@PathVariable String commodity,
                                               @PathVariable Long id,
                                               @RequestBody AssignSiteRequest req) {
        specService.resolveSlug(commodity);
        return service.assignSite(id, req.getSiteCode(), req.getLots());
    }

    @DeleteMapping("/allocations/{allocationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String commodity, @PathVariable Long allocationId) {
        specService.resolveSlug(commodity);
        service.delete(allocationId);
    }
}
