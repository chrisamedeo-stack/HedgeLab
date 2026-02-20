package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateCounterpartyRequest;
import com.hedgelab.api.dto.response.CounterpartyResponse;
import com.hedgelab.api.dto.response.CreditUtilizationResponse;
import com.hedgelab.api.entity.CounterpartyStatus;
import com.hedgelab.api.entity.CounterpartyType;
import com.hedgelab.api.service.CounterpartyService;
import com.hedgelab.api.service.RiskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/counterparties")
@RequiredArgsConstructor
@Tag(name = "Counterparties", description = "Counterparty master data and credit management")
public class CounterpartyController {

    private final CounterpartyService counterpartyService;
    private final RiskService riskService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Onboard a new counterparty")
    public CounterpartyResponse create(@Valid @RequestBody CreateCounterpartyRequest req) {
        return counterpartyService.create(req);
    }

    @GetMapping
    @Operation(summary = "Search counterparties")
    public List<CounterpartyResponse> getAll(
            @RequestParam(required = false) CounterpartyStatus status,
            @RequestParam(required = false) CounterpartyType type) {
        return counterpartyService.getAll(status, type);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get counterparty by ID")
    public CounterpartyResponse getById(@PathVariable Long id) {
        return counterpartyService.getById(id);
    }

    @GetMapping("/by-code/{code}")
    @Operation(summary = "Get counterparty by legal entity code")
    public CounterpartyResponse getByCode(@PathVariable String code) {
        return counterpartyService.getByCode(code);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update counterparty details")
    public CounterpartyResponse update(@PathVariable Long id, @Valid @RequestBody CreateCounterpartyRequest req) {
        return counterpartyService.update(id, req);
    }

    @PatchMapping("/{id}/credit-limit")
    @Operation(summary = "Update credit limit (USD)")
    public CounterpartyResponse updateCreditLimit(@PathVariable Long id, @RequestBody Map<String, BigDecimal> body) {
        return counterpartyService.updateCreditLimit(id, body.get("creditLimitUsd"));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Change counterparty status")
    public CounterpartyResponse updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return counterpartyService.updateStatus(id, CounterpartyStatus.valueOf(body.get("status")));
    }

    @GetMapping("/{id}/credit-utilization")
    @Operation(summary = "Get latest credit utilization snapshot")
    public CreditUtilizationResponse getCreditUtilization(@PathVariable Long id) {
        return riskService.getCreditUtilization(id);
    }
}
