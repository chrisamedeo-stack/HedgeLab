package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateHedgeAllocationRequest;
import com.hedgelab.api.dto.response.HedgeAllocationResponse;
import com.hedgelab.api.service.HedgeAllocationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/hedges")
@RequiredArgsConstructor
public class HedgeAllocationController {

    private final HedgeAllocationService service;

    @GetMapping("/{id}/allocations")
    public List<HedgeAllocationResponse> getAllocations(@PathVariable Long id) {
        return service.getAllocationsForTrade(id);
    }

    @PostMapping("/{id}/allocations")
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeAllocationResponse create(@PathVariable Long id,
                                          @RequestBody CreateHedgeAllocationRequest req) {
        return service.create(id, req);
    }

    @DeleteMapping("/allocations/{allocationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long allocationId) {
        service.delete(allocationId);
    }
}
