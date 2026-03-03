package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateOffsetRequest;
import com.hedgelab.api.dto.response.HedgeOffsetResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.HedgeOffsetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/hedges")
@RequiredArgsConstructor
public class HedgeOffsetController {

    private final HedgeOffsetService service;
    private final CommoditySpecService specService;

    @PostMapping("/{id}/offset")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeOffsetResponse offsetFromPool(@PathVariable String commodity,
                                               @PathVariable Long id,
                                               @RequestBody CreateOffsetRequest req) {
        specService.resolveSlug(commodity);
        return service.offsetFromPool(id, req);
    }

    @PostMapping("/allocations/{allocationId}/offset")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeOffsetResponse offsetFromAllocation(@PathVariable String commodity,
                                                     @PathVariable Long allocationId,
                                                     @RequestBody CreateOffsetRequest req) {
        specService.resolveSlug(commodity);
        return service.offsetFromAllocation(allocationId, req);
    }

    @GetMapping("/offsets")
    public List<HedgeOffsetResponse> getByBook(@PathVariable String commodity,
                                                @RequestParam(required = false) String book) {
        String code = specService.resolveSlug(commodity);
        return service.getByBook(code, book);
    }

    @DeleteMapping("/offsets/{offsetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOffset(@PathVariable String commodity, @PathVariable Long offsetId) {
        specService.resolveSlug(commodity);
        service.deleteOffset(offsetId);
    }
}
