package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.VaRResult;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.DailyPriceRepository;
import com.hedgelab.api.repository.PriceIndexRepository;
import com.hedgelab.api.repository.RiskMetricRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class VaRCalculationService {

    private final DailyPriceRepository dailyPriceRepo;
    private final PriceIndexRepository priceIndexRepo;
    private final RiskMetricRepository riskMetricRepo;

    @Value("${hedgelab.risk.var-lookback-days:252}")
    private int defaultLookbackDays;

    /**
     * Calculate Historical VaR for a given price index and position size.
     *
     * @param priceIndexId  ID of the price index to use for historical returns
     * @param positionSize  Net position size (positive = long, negative = short)
     * @param lookbackDays  Number of trading days to use (default 252 = 1 year)
     */
    @Transactional(readOnly = true)
    public VaRResult calculateHistoricalVaR(Long priceIndexId, BigDecimal positionSize, int lookbackDays) {
        PriceIndex index = priceIndexRepo.findById(priceIndexId)
                .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", priceIndexId));

        LocalDate toDate = LocalDate.now();
        LocalDate fromDate = toDate.minusDays(lookbackDays + 30); // buffer for weekends/holidays

        List<DailyPrice> prices = dailyPriceRepo.findByPriceIndexAndPriceDateBetweenOrderByPriceDateAsc(
                index, fromDate, toDate);

        if (prices.size() < 2) {
            log.warn("Insufficient price data for VaR calculation: {} prices found", prices.size());
            return new VaRResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    0, lookbackDays, toDate);
        }

        // Compute log returns: ln(P_t / P_{t-1})
        List<Double> logReturns = new ArrayList<>();
        for (int i = 1; i < prices.size(); i++) {
            double p0 = prices.get(i - 1).getPrice().doubleValue();
            double p1 = prices.get(i).getPrice().doubleValue();
            if (p0 > 0 && p1 > 0) {
                logReturns.add(Math.log(p1 / p0));
            }
        }

        // Cap at lookbackDays observations
        if (logReturns.size() > lookbackDays) {
            logReturns = logReturns.subList(logReturns.size() - lookbackDays, logReturns.size());
        }

        if (logReturns.isEmpty()) {
            return new VaRResult(BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    0, lookbackDays, toDate);
        }

        Collections.sort(logReturns); // ascending — worst returns first

        int n = logReturns.size();
        // Current price (latest)
        double currentPrice = prices.get(prices.size() - 1).getPrice().doubleValue();
        double absPosition = Math.abs(positionSize.doubleValue());

        // VaR = |positionSize × currentPrice × return_at_percentile|
        // For 95% VaR: index at floor(0.05 × n)
        // For 99% VaR: index at floor(0.01 × n)
        double var1d95 = computeVaR(logReturns, absPosition, currentPrice, 0.05);
        double var1d99 = computeVaR(logReturns, absPosition, currentPrice, 0.01);

        // Scale to 10-day horizon: VaR_10d = VaR_1d × sqrt(10)
        double sqrtTen = Math.sqrt(10.0);
        double var10d95 = var1d95 * sqrtTen;
        double var10d99 = var1d99 * sqrtTen;

        return new VaRResult(
                toBD(var1d95),
                toBD(var1d99),
                toBD(var10d95),
                toBD(var10d99),
                n,
                lookbackDays,
                toDate
        );
    }

    /**
     * Compute historical volatility (annualized) from log returns.
     * σ_annual = std(daily_returns) × sqrt(252)
     */
    @Transactional(readOnly = true)
    public double calculateHistoricalVolatility(Long priceIndexId, int lookbackDays) {
        PriceIndex index = priceIndexRepo.findById(priceIndexId)
                .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", priceIndexId));

        LocalDate toDate = LocalDate.now();
        LocalDate fromDate = toDate.minusDays(lookbackDays + 30);

        List<DailyPrice> prices = dailyPriceRepo.findByPriceIndexAndPriceDateBetweenOrderByPriceDateAsc(
                index, fromDate, toDate);

        if (prices.size() < 2) return 0.3; // fallback to 30% vol

        List<Double> logReturns = new ArrayList<>();
        for (int i = 1; i < prices.size(); i++) {
            double p0 = prices.get(i - 1).getPrice().doubleValue();
            double p1 = prices.get(i).getPrice().doubleValue();
            if (p0 > 0 && p1 > 0) logReturns.add(Math.log(p1 / p0));
        }

        if (logReturns.size() < 2) return 0.3;

        double mean = logReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = logReturns.stream()
                .mapToDouble(r -> (r - mean) * (r - mean))
                .sum() / (logReturns.size() - 1);
        return Math.sqrt(variance) * Math.sqrt(252.0);
    }

    @Transactional
    public void saveVaRMetrics(VaRResult result) {
        LocalDate today = LocalDate.now();
        saveMetric(RiskMetricType.VAR_1D_95,  result.var1d95(),  today);
        saveMetric(RiskMetricType.VAR_1D_99,  result.var1d99(),  today);
        saveMetric(RiskMetricType.VAR_10D_95, result.var10d95(), today);
        saveMetric(RiskMetricType.VAR_10D_99, result.var10d99(), today);
    }

    private void saveMetric(RiskMetricType type, BigDecimal value, LocalDate date) {
        RiskMetric metric = RiskMetric.builder()
                .metricType(type)
                .metricDate(date)
                .metricValue(value)
                .currency("USD")
                .methodology("Historical VaR")
                .calculatedAt(java.time.Instant.now())
                .build();
        riskMetricRepo.save(metric);
    }

    private double computeVaR(List<Double> sortedReturns, double absPosition, double currentPrice, double tailProb) {
        int idx = (int) Math.floor(tailProb * sortedReturns.size());
        idx = Math.max(0, Math.min(idx, sortedReturns.size() - 1));
        double worstReturn = sortedReturns.get(idx);
        return Math.abs(absPosition * currentPrice * worstReturn);
    }

    private BigDecimal toBD(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }
}
