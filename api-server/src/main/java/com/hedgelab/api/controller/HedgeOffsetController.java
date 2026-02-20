package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateOffsetRequest;
import com.hedgelab.api.dto.response.HedgeOffsetResponse;
import com.hedgelab.api.service.HedgeOffsetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/hedges")
@RequiredArgsConstructor
public class HedgeOffsetController {

    private final HedgeOffsetService service;

    /** Offset unallocated lots directly from the hedge pool. */
    @PostMapping("/{id}/offset")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeOffsetResponse offsetFromPool(@PathVariable Long id,
                                              @RequestBody CreateOffsetRequest req) {
        return service.offsetFromPool(id, req);
    }

    /** Offset lots from a specific site allocation. */
    @PostMapping("/allocations/{allocationId}/offset")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeOffsetResponse offsetFromAllocation(@PathVariable Long allocationId,
                                                    @RequestBody CreateOffsetRequest req) {
        return service.offsetFromAllocation(allocationId, req);
    }

    /** List all offsets for a given book. */
    @GetMapping("/offsets")
    public List<HedgeOffsetResponse> getByBook(@RequestParam(required = false) String book) {
        return service.getByBook(book);
    }
}
