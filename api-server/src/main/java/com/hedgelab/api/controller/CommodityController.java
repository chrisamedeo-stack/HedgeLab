package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateCommodityRequest;
import com.hedgelab.api.dto.response.CommodityResponse;
import com.hedgelab.api.entity.CommodityCategory;
import com.hedgelab.api.service.CommodityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/commodities")
@RequiredArgsConstructor
@Tag(name = "Commodities", description = "Commodity catalog management")
public class CommodityController {

    private final CommodityService commodityService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new commodity")
    public CommodityResponse create(@Valid @RequestBody CreateCommodityRequest req) {
        return commodityService.create(req);
    }

    @GetMapping
    @Operation(summary = "List commodities with optional filters")
    public List<CommodityResponse> getAll(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) CommodityCategory category) {
        return commodityService.getAll(active, category);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get commodity by ID")
    public CommodityResponse getById(@PathVariable Long id) {
        return commodityService.getById(id);
    }

    @GetMapping("/by-code/{code}")
    @Operation(summary = "Get commodity by code")
    public CommodityResponse getByCode(@PathVariable String code) {
        return commodityService.getByCode(code);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update commodity")
    public CommodityResponse update(@PathVariable Long id, @Valid @RequestBody CreateCommodityRequest req) {
        return commodityService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deactivate commodity")
    public void deactivate(@PathVariable Long id) {
        commodityService.deactivate(id);
    }
}
