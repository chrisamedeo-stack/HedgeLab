package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateFormulaRequest;
import com.hedgelab.api.entity.PriceFormula;
import com.hedgelab.api.service.FormulaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/pricing")
@RequiredArgsConstructor
@Tag(name = "Pricing", description = "Pricing formula management")
public class PricingController {

    private final FormulaService formulaService;

    @PostMapping("/formulas")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new pricing formula")
    public Map<String, Object> createFormula(@Valid @RequestBody CreateFormulaRequest req) {
        PriceFormula formula = formulaService.create(req);
        return toMap(formula);
    }

    @GetMapping("/formulas")
    @Operation(summary = "List all active pricing formulas")
    public List<Map<String, Object>> listFormulas() {
        return formulaService.getAll().stream().map(this::toMap).collect(Collectors.toList());
    }

    @GetMapping("/formulas/{id}")
    @Operation(summary = "Get a pricing formula by ID")
    public Map<String, Object> getFormula(@PathVariable Long id) {
        return toMap(formulaService.getById(id));
    }

    @DeleteMapping("/formulas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Deactivate a pricing formula")
    public void deactivateFormula(@PathVariable Long id) {
        formulaService.deactivate(id);
    }

    private Map<String, Object> toMap(PriceFormula f) {
        List<Map<String, Object>> components = f.getComponents() == null ? List.of() :
            f.getComponents().stream().map(c -> Map.<String, Object>of(
                "sequenceOrder", c.getSequenceOrder(),
                "componentLabel", c.getComponentLabel() != null ? c.getComponentLabel() : "",
                "componentType", c.getComponentType(),
                "weight", c.getWeight()
            )).collect(Collectors.toList());

        return Map.of(
            "id", f.getId(),
            "formulaCode", f.getFormulaCode(),
            "displayName", f.getDisplayName(),
            "active", f.isActive(),
            "components", components
        );
    }
}
