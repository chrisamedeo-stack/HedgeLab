package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.PricingResultResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.HedgeLabException;
import com.hedgelab.api.repository.DailyPriceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;

@Service
@RequiredArgsConstructor
public class PricingEngineService {

    private static final MathContext MC = new MathContext(20, RoundingMode.HALF_UP);
    private static final int PRICE_SCALE = 6;

    private final DailyPriceRepository dailyPriceRepo;
    private final MarketDataService marketDataService;

    @Transactional(readOnly = true)
    public PricingResultResponse calculate(Trade trade, LocalDate asOfDate) {
        BigDecimal unitPrice = resolveUnitPrice(trade, asOfDate);
        BigDecimal spread = trade.getSpread() != null ? trade.getSpread() : BigDecimal.ZERO;
        BigDecimal totalPrice = unitPrice.add(spread).setScale(PRICE_SCALE, RoundingMode.HALF_UP);
        BigDecimal notional = trade.getQuantity().multiply(totalPrice, MC).setScale(2, RoundingMode.HALF_UP);

        String method = switch (trade.getPricingType()) {
            case FIXED -> "FIXED_PRICE";
            case INDEX -> "INDEX:" + trade.getPriceIndex().getIndexCode();
            case FORMULA -> "FORMULA:" + trade.getPriceFormula().getFormulaCode();
        };

        return new PricingResultResponse(
            trade.getId(), trade.getTradeReference(), asOfDate,
            trade.getPricingType(), unitPrice, spread, totalPrice,
            trade.getQuantity(), notional, trade.getCurrency(), method
        );
    }

    public BigDecimal resolveUnitPrice(Trade trade, LocalDate asOfDate) {
        return switch (trade.getPricingType()) {
            case FIXED -> trade.getFixedPrice();
            case INDEX  -> resolveIndexPrice(trade.getPriceIndex(), asOfDate);
            case FORMULA -> resolveFormulaPrice(trade.getPriceFormula(), asOfDate);
        };
    }

    private BigDecimal resolveIndexPrice(PriceIndex index, LocalDate asOfDate) {
        // Try exact date first, fall back to latest confirmed
        return dailyPriceRepo.findByPriceIndexAndPriceDateAndPriceType(index, asOfDate, "SETTLE")
            .map(DailyPrice::getPrice)
            .orElseGet(() -> dailyPriceRepo
                .findTopByPriceIndexAndConfirmedTrueOrderByPriceDateDesc(index)
                .map(DailyPrice::getPrice)
                .orElseThrow(() -> new HedgeLabException(
                    "No price data available for index: " + index.getIndexCode(), HttpStatus.UNPROCESSABLE_ENTITY)));
    }

    private BigDecimal resolveFormulaPrice(PriceFormula formula, LocalDate asOfDate) {
        BigDecimal total = BigDecimal.ZERO;
        for (FormulaComponent component : formula.getComponents()) {
            BigDecimal componentPrice;
            if (component.getComponentType() == PricingType.FIXED) {
                componentPrice = component.getFixedValue();
            } else {
                BigDecimal indexPrice = resolveIndexPrice(component.getReferenceIndex(), asOfDate);
                componentPrice = indexPrice.multiply(component.getWeight(), MC);
            }
            // Apply cap/floor per component
            if (component.getCap() != null && componentPrice.compareTo(component.getCap()) > 0) {
                componentPrice = component.getCap();
            }
            if (component.getFloor() != null && componentPrice.compareTo(component.getFloor()) < 0) {
                componentPrice = component.getFloor();
            }
            total = total.add(componentPrice);
        }
        return total.setScale(PRICE_SCALE, RoundingMode.HALF_UP);
    }

    public BigDecimal calculateMtmPrice(Trade trade, YearMonth deliveryMonth) {
        PriceIndex index = switch (trade.getPricingType()) {
            case FIXED -> null;
            case INDEX -> trade.getPriceIndex();
            case FORMULA -> trade.getPriceFormula().getComponents().stream()
                .filter(c -> c.getComponentType() == PricingType.INDEX)
                .findFirst()
                .map(FormulaComponent::getReferenceIndex)
                .orElse(null);
        };
        if (index == null) return BigDecimal.ZERO;
        return marketDataService.resolveForwardPrice(index, deliveryMonth);
    }
}
