package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreatePhysicalContractRequest;
import com.hedgelab.api.dto.request.LockBasisRequest;
import com.hedgelab.api.dto.response.PhysicalContractResponse;
import com.hedgelab.api.service.PhysicalContractService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/contracts")
@RequiredArgsConstructor
public class PhysicalContractController {
    private final PhysicalContractService service;

    @GetMapping
    public List<PhysicalContractResponse> getAll(@RequestParam(required = false) String site) {
        return site != null ? service.getBySite(site) : service.getAllContracts();
    }

    @GetMapping("/{id}")
    public PhysicalContractResponse getById(@PathVariable Long id) {
        return service.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PhysicalContractResponse create(@RequestBody CreatePhysicalContractRequest req) {
        return service.create(req);
    }

    @PatchMapping("/{id}/lock-basis")
    public PhysicalContractResponse lockBasis(@PathVariable Long id,
                                              @RequestBody LockBasisRequest req) {
        return service.lockBasis(id, req);
    }

    @PostMapping("/{id}/issue-po")
    public PhysicalContractResponse issuePo(@PathVariable Long id) {
        return service.issuePo(id);
    }

    @PostMapping("/{id}/cancel")
    public PhysicalContractResponse cancel(@PathVariable Long id) {
        return service.cancel(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.cancel(id);
    }
}
