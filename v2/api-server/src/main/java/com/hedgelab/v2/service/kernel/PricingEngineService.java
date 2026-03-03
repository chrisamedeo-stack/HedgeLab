package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.PricingFormula;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.kernel.PricingFormulaRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class PricingEngineService {

    private final PricingFormulaRepository formulaRepository;

    public List<PricingFormula> listFormulas(UUID orgId, String commodityId) {
        if (commodityId != null) {
            return formulaRepository.findActiveByOrgIdAndCommodityId(orgId, commodityId);
        }
        return formulaRepository.findActiveByOrgId(orgId);
    }

    public PricingFormula getFormula(UUID formulaId) {
        return formulaRepository.findById(formulaId)
                .orElseThrow(() -> new ResourceNotFoundException("PricingFormula", formulaId));
    }

    public PricingFormula createFormula(PricingFormula formula) {
        return formulaRepository.save(formula);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> evaluate(UUID formulaId, Map<String, BigDecimal> inputs,
                                        Map<String, BigDecimal> marketPrices,
                                        Map<String, BigDecimal> fxRates) {
        PricingFormula formula = getFormula(formulaId);
        Map<String, BigDecimal> componentValues = new LinkedHashMap<>();
        List<String> errors = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Map<String, Object> comp : formula.getComponents()) {
            String compId = (String) comp.get("id");
            String type = (String) comp.get("type");
            BigDecimal value = BigDecimal.ZERO;

            try {
                switch (type) {
                    case "fixed" -> {
                        Number fixedVal = (Number) comp.get("fixedValue");
                        value = fixedVal != null ? new BigDecimal(fixedVal.toString()) : BigDecimal.ZERO;
                    }
                    case "input" -> {
                        value = inputs != null ? inputs.getOrDefault(compId, BigDecimal.ZERO) : BigDecimal.ZERO;
                    }
                    case "market_ref" -> {
                        Map<String, String> ref = (Map<String, String>) comp.get("marketRef");
                        if (ref != null && marketPrices != null) {
                            String key = ref.get("commodityId") + "." + ref.get("priceField");
                            value = marketPrices.getOrDefault(key, BigDecimal.ZERO);
                        }
                    }
                    case "fx" -> {
                        Map<String, String> ref = (Map<String, String>) comp.get("fxRef");
                        if (ref != null && fxRates != null) {
                            String key = ref.get("fromCurrency") + "/" + ref.get("toCurrency");
                            value = fxRates.getOrDefault(key, BigDecimal.ONE);
                        }
                    }
                    case "percentage" -> {
                        Map<String, Object> ref = (Map<String, Object>) comp.get("percentOf");
                        if (ref != null) {
                            String targetId = (String) ref.get("componentId");
                            Number pct = (Number) ref.get("percent");
                            BigDecimal base = componentValues.getOrDefault(targetId, BigDecimal.ZERO);
                            value = base.multiply(new BigDecimal(pct.toString())).divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
                        }
                    }
                    default -> errors.add("Unknown component type: " + type);
                }
            } catch (Exception e) {
                errors.add("Error evaluating component " + compId + ": " + e.getMessage());
            }

            componentValues.put(compId, value);
            Boolean isOutput = (Boolean) comp.get("isOutput");
            if (isOutput != null && isOutput) {
                total = total.add(value);
            }
        }

        if (total.equals(BigDecimal.ZERO) && !componentValues.isEmpty()) {
            total = componentValues.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        total = total.setScale(formula.getRounding(), RoundingMode.HALF_UP);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("componentValues", componentValues);
        result.put("totalPrice", total);
        result.put("currency", "USD");
        result.put("errors", errors);
        return result;
    }
}
