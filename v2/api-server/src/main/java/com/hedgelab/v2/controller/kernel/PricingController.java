package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.PricingFormula;
import com.hedgelab.v2.service.kernel.PricingEngineService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v2/kernel/pricing")
@RequiredArgsConstructor
public class PricingController {

    private final PricingEngineService pricingEngineService;

    @GetMapping
    public List<PricingFormula> list(@RequestParam UUID orgId,
                                     @RequestParam(required = false) String commodityId) {
        return pricingEngineService.listFormulas(orgId, commodityId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @SuppressWarnings("unchecked")
    public Object create(@RequestBody Map<String, Object> body) {
        String action = (String) body.get("action");
        if ("evaluate".equals(action)) {
            UUID formulaId = UUID.fromString((String) body.get("formulaId"));
            Map<String, BigDecimal> inputs = toBigDecimalMap((Map<String, Object>) body.get("inputs"));
            Map<String, BigDecimal> marketPrices = toBigDecimalMap((Map<String, Object>) body.get("marketPrices"));
            Map<String, BigDecimal> fxRates = toBigDecimalMap((Map<String, Object>) body.get("fxRates"));
            return pricingEngineService.evaluate(formulaId, inputs, marketPrices, fxRates);
        }
        // create formula
        PricingFormula formula = PricingFormula.builder()
                .orgId(UUID.fromString((String) body.get("orgId")))
                .name((String) body.get("name"))
                .description((String) body.get("description"))
                .commodityId((String) body.get("commodityId"))
                .formulaType((String) body.get("formulaType"))
                .components((List<Map<String, Object>>) body.get("components"))
                .outputUnit((String) body.get("outputUnit"))
                .rounding(body.containsKey("rounding") ? (Integer) body.get("rounding") : 4)
                .build();
        return pricingEngineService.createFormula(formula);
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> toBigDecimalMap(Map<String, Object> map) {
        if (map == null) return null;
        return map.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> new BigDecimal(e.getValue().toString())));
    }
}
