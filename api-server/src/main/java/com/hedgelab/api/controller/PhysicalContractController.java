package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreatePhysicalContractRequest;
import com.hedgelab.api.dto.request.LockBasisRequest;
import com.hedgelab.api.dto.request.UpdatePhysicalContractRequest;
import com.hedgelab.api.dto.response.PhysicalContractResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.PhysicalContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/contracts")
@RequiredArgsConstructor
public class PhysicalContractController {
    private final PhysicalContractService service;
    private final CommoditySpecService specService;

    @GetMapping
    public List<PhysicalContractResponse> getAll(@PathVariable String commodity,
                                                  @RequestParam(required = false) String site) {
        String code = specService.resolveSlug(commodity);
        return site != null ? service.getBySite(code, site) : service.getAllContracts(code);
    }

    @GetMapping("/{id}")
    public PhysicalContractResponse getById(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return service.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PhysicalContractResponse create(@PathVariable String commodity,
                                            @RequestBody CreatePhysicalContractRequest req) {
        String code = specService.resolveSlug(commodity);
        return service.create(code, req);
    }

    @PostMapping("/bulk")
    public List<PhysicalContractResponse> createBulk(@PathVariable String commodity,
                                                      @RequestBody List<CreatePhysicalContractRequest> requests) {
        String code = specService.resolveSlug(commodity);
        return service.createBulk(code, requests);
    }

    @PutMapping("/{id}")
    public PhysicalContractResponse update(@PathVariable String commodity,
                                            @PathVariable Long id,
                                            @RequestBody UpdatePhysicalContractRequest req) {
        specService.resolveSlug(commodity);
        return service.update(id, req);
    }

    @PatchMapping("/{id}/lock-basis")
    public PhysicalContractResponse lockBasis(@PathVariable String commodity,
                                               @PathVariable Long id,
                                               @RequestBody LockBasisRequest req) {
        specService.resolveSlug(commodity);
        return service.lockBasis(id, req);
    }

    @PostMapping("/{id}/issue-po")
    public PhysicalContractResponse issuePo(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return service.issuePo(id);
    }

    @PostMapping("/{id}/cancel")
    public PhysicalContractResponse cancel(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return service.cancel(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        service.deleteContract(id);
    }
}
