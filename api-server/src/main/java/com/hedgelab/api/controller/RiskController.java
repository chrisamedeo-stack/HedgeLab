package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.Black76Result;
import com.hedgelab.api.dto.response.CreditUtilizationResponse;
import com.hedgelab.api.dto.response.RiskMetricResponse;
import com.hedgelab.api.dto.response.VaRResult;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.DailyPriceRepository;
import com.hedgelab.api.repository.TradeRepository;
import com.hedgelab.api.service.Black76Service;
import com.hedgelab.api.service.RiskService;
import com.hedgelab.api.service.VaRCalculationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/risk")
@RequiredArgsConstructor
@Tag(name = "Risk", description = "Credit utilization, VaR, and options Greeks")
public class RiskController {

    private final RiskService riskService;
    private final VaRCalculationService varService;
    private final Black76Service black76Service;
    private final TradeRepository tradeRepo;
    private final DailyPriceRepository dailyPriceRepo;

    // ------------------------------------------------------------------ credit

    @PostMapping("/credit-utilizations/recalculate")
    @Operation(summary = "Recalculate credit utilization for all active counterparties")
    public Map<String, Object> recalculateAll(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate snapshotDate) {
        LocalDate date = snapshotDate != null ? snapshotDate : LocalDate.now();
        int count = riskService.recalculateAllCreditUtilizations(date);
        return Map.of("snapshotDate", date.toString(), "counterpartiesProcessed", count);
    }

    @GetMapping("/credit-utilizations/{counterpartyId}")
    @Operation(summary = "Get latest credit utilization for a counterparty")
    public CreditUtilizationResponse getCreditUtilization(@PathVariable Long counterpartyId) {
        return riskService.getCreditUtilization(counterpartyId);
    }

    @GetMapping("/credit-utilizations/alerts")
    @Operation(summary = "Get all counterparties with AMBER or RED credit utilization")
    public List<CreditUtilizationResponse> getAlerts() {
        return riskService.getAlertedCounterparties();
    }

    @PostMapping("/metrics/net-exposure")
    @Operation(summary = "Calculate net exposure for a book and commodity")
    public RiskMetricResponse calculateNetExposure(
            @RequestParam Long bookId,
            @RequestParam Long commodityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return riskService.calculateNetExposure(bookId, commodityId, date != null ? date : LocalDate.now());
    }

    // ------------------------------------------------------------------ VaR

    @PostMapping("/var/calculate")
    @Operation(summary = "Calculate historical VaR for a price index and position size")
    public VaRResult calculateVaR(
            @RequestParam Long priceIndexId,
            @RequestParam BigDecimal positionSize,
            @RequestParam(defaultValue = "252") int lookbackDays) {
        VaRResult result = varService.calculateHistoricalVaR(priceIndexId, positionSize, lookbackDays);
        varService.saveVaRMetrics(result);
        return result;
    }

    @GetMapping("/var/volatility")
    @Operation(summary = "Get annualized historical volatility for a price index")
    public Map<String, Object> getHistoricalVolatility(
            @RequestParam Long priceIndexId,
            @RequestParam(defaultValue = "60") int lookbackDays) {
        double vol = varService.calculateHistoricalVolatility(priceIndexId, lookbackDays);
        return Map.of(
                "priceIndexId", priceIndexId,
                "lookbackDays", lookbackDays,
                "annualizedVolatility", vol,
                "calculationDate", LocalDate.now().toString()
        );
    }

    // ------------------------------------------------------------------ Greeks

    @GetMapping("/greeks/{tradeId}")
    @Operation(summary = "Calculate Black-76 Greeks for an option trade")
    public Black76Result getGreeks(@PathVariable Long tradeId) {
        Trade trade = tradeRepo.findById(tradeId)
                .orElseThrow(() -> new ResourceNotFoundException("Trade", tradeId));

        if (trade.getTradeType() != TradeType.OPTION_CALL && trade.getTradeType() != TradeType.OPTION_PUT) {
            throw new IllegalArgumentException("Trade " + tradeId + " is not an option (type=" + trade.getTradeType() + ")");
        }

        // Strike = fixedPrice on the option trade
        BigDecimal strike = trade.getFixedPrice();
        if (strike == null || strike.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Option trade must have a positive fixedPrice as strike");
        }

        // Forward price = latest confirmed market price from the linked price index
        PriceIndex priceIndex = trade.getPriceIndex();
        if (priceIndex == null) {
            throw new IllegalArgumentException("Option trade must be linked to a price index for forward price");
        }

        DailyPrice latestPrice = dailyPriceRepo
                .findTopByPriceIndexAndConfirmedTrueOrderByPriceDateDesc(priceIndex)
                .orElseThrow(() -> new ResourceNotFoundException("DailyPrice for index", priceIndex.getId()));

        BigDecimal forward = latestPrice.getPrice();

        // Time to expiry: use trade endDate as expiry proxy; minimum 1 day
        long daysToExpiry = Math.max(1L, ChronoUnit.DAYS.between(LocalDate.now(), trade.getEndDate()));
        double T = daysToExpiry / 365.0;

        // Sigma: prefer explicitly stored impliedVolatility on the trade; else derive historically
        if (trade.getImpliedVolatility() != null && trade.getImpliedVolatility().compareTo(BigDecimal.ZERO) > 0) {
            double sigma = trade.getImpliedVolatility().doubleValue();
            return black76Service.calculate(trade.getTradeType(), forward, strike, 0.05, sigma, T);
        }

        return black76Service.calculateWithHistoricalVol(trade.getTradeType(), forward, strike, priceIndex.getId(), T);
    }

    @PostMapping("/greeks/calculate")
    @Operation(summary = "Calculate Black-76 Greeks for arbitrary parameters")
    public Black76Result calculateGreeks(
            @RequestParam String tradeType,
            @RequestParam BigDecimal forward,
            @RequestParam BigDecimal strike,
            @RequestParam(defaultValue = "0.05") double riskFreeRate,
            @RequestParam double volatility,
            @RequestParam double timeToExpiryYears) {
        TradeType type = TradeType.valueOf(tradeType.toUpperCase());
        return black76Service.calculate(type, forward, strike, riskFreeRate, volatility, timeToExpiryYears);
    }
}
