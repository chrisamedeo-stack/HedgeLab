package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.Black76Result;
import com.hedgelab.api.entity.TradeType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.math3.distribution.NormalDistribution;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Black-76 model for pricing commodity futures options.
 *
 * Black-76 treats the futures price F as the underlying:
 *   d1 = [ln(F/K) + 0.5 × σ² × T] / (σ × √T)
 *   d2 = d1 − σ × √T
 *
 * Call premium  = e^{−rT} × [F × N(d1) − K × N(d2)]
 * Put  premium  = e^{−rT} × [K × N(−d2) − F × N(−d1)]
 *
 * Call delta    = e^{−rT} × N(d1)
 * Put  delta    = e^{−rT} × [N(d1) − 1]
 *
 * Gamma (call & put) = e^{−rT} × φ(d1) / (F × σ × √T)
 * Vega  (call & put) = e^{−rT} × F × φ(d1) × √T    (per unit of σ)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Black76Service {

    private static final NormalDistribution NORM = new NormalDistribution();

    private final VaRCalculationService varCalculationService;

    @Value("${hedgelab.risk.black76-risk-free-rate:0.05}")
    private double defaultRiskFreeRate;

    @Value("${hedgelab.risk.vol-lookback-days:60}")
    private int defaultVolLookbackDays;

    /**
     * Full Black-76 pricing and Greeks for a single option leg.
     *
     * @param tradeType  OPTION_CALL or OPTION_PUT (determines sign of delta)
     * @param F          Futures price (forward price of the underlying)
     * @param K          Strike price
     * @param r          Risk-free interest rate (annualized, e.g. 0.05 = 5%)
     * @param sigma      Annualized volatility (e.g. 0.30 = 30%)
     * @param T          Time to expiry in years (e.g. 0.25 = 3 months)
     * @return           Black76Result with delta, gamma, vega, premium
     */
    public Black76Result calculate(TradeType tradeType, BigDecimal F, BigDecimal K,
                                   double r, double sigma, double T) {
        if (!isOption(tradeType)) {
            throw new IllegalArgumentException("Black-76 only applies to OPTION_CALL or OPTION_PUT trades");
        }

        double f = F.doubleValue();
        double k = K.doubleValue();

        if (f <= 0 || k <= 0 || sigma <= 0 || T <= 0) {
            log.warn("Degenerate Black-76 inputs: F={}, K={}, sigma={}, T={}", f, k, sigma, T);
            return zeroResult();
        }

        double sqrtT = Math.sqrt(T);
        double d1 = (Math.log(f / k) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
        double d2 = d1 - sigma * sqrtT;

        double discountFactor = Math.exp(-r * T);
        double nd1  = NORM.cumulativeProbability(d1);
        double nd2  = NORM.cumulativeProbability(d2);
        double nd1n = NORM.cumulativeProbability(-d1);
        double nd2n = NORM.cumulativeProbability(-d2);
        double phiD1 = NORM.density(d1);

        boolean isCall = (tradeType == TradeType.OPTION_CALL);

        double premium = isCall
                ? discountFactor * (f * nd1 - k * nd2)
                : discountFactor * (k * nd2n - f * nd1n);

        double delta = isCall
                ? discountFactor * nd1
                : discountFactor * (nd1 - 1.0);

        double gamma = discountFactor * phiD1 / (f * sigma * sqrtT);

        // Vega: sensitivity of premium to 1% change in vol (divided by 100 → per 1% point)
        double vega  = discountFactor * f * phiD1 * sqrtT / 100.0;

        return new Black76Result(delta, gamma, vega, premium, sigma, d1, d2, LocalDate.now());
    }

    /**
     * Convenience overload using the configured default risk-free rate
     * and historical volatility derived from price index history.
     */
    public Black76Result calculateWithHistoricalVol(TradeType tradeType, BigDecimal F, BigDecimal K,
                                                     Long priceIndexId, double T) {
        double sigma = varCalculationService.calculateHistoricalVolatility(priceIndexId, defaultVolLookbackDays);
        return calculate(tradeType, F, K, defaultRiskFreeRate, sigma, T);
    }

    // ------------------------------------------------------------------ helpers

    private boolean isOption(TradeType type) {
        return type == TradeType.OPTION_CALL || type == TradeType.OPTION_PUT;
    }

    private Black76Result zeroResult() {
        return new Black76Result(0, 0, 0, 0, 0, 0, 0, LocalDate.now());
    }
}
