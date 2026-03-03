package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.FxRate;
import com.hedgelab.v2.repository.kernel.FxRateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class FxService {

    private final FxRateRepository fxRateRepository;

    public Map<String, Object> convert(BigDecimal amount, String from, String to, LocalDate date) {
        if (from.equals(to)) {
            return Map.of("amount", amount, "rate", BigDecimal.ONE, "rateDate", date != null ? date.toString() : LocalDate.now().toString(), "isStale", false);
        }

        Optional<FxRate> rateOpt = date != null
                ? fxRateRepository.findLatestRate(from, to, date)
                : fxRateRepository.findLatestRate(from, to);

        if (rateOpt.isEmpty()) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("amount", null);
            result.put("rate", null);
            result.put("rateDate", null);
            result.put("isStale", true);
            result.put("error", "No FX rate found for " + from + "/" + to);
            return result;
        }

        FxRate fx = rateOpt.get();
        BigDecimal converted = amount.multiply(fx.getRate()).setScale(6, RoundingMode.HALF_UP);
        boolean isStale = fx.getRateDate().isBefore(LocalDate.now().minusDays(7));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("amount", converted);
        result.put("rate", fx.getRate());
        result.put("rateDate", fx.getRateDate().toString());
        result.put("isStale", isStale);
        return result;
    }

    public FxRate upsert(String from, String to, LocalDate date, BigDecimal rate, String source) {
        Optional<FxRate> existing = fxRateRepository.findByFromCurrencyAndToCurrencyAndRateDate(from, to, date);
        if (existing.isPresent()) {
            FxRate fx = existing.get();
            fx.setRate(rate);
            fx.setSource(source != null ? source : "manual");
            return fxRateRepository.save(fx);
        }
        return fxRateRepository.save(FxRate.builder()
                .fromCurrency(from)
                .toCurrency(to)
                .rateDate(date)
                .rate(rate)
                .source(source != null ? source : "manual")
                .build());
    }

    public List<FxRate> listAll() {
        return fxRateRepository.findAllByOrderByRateDateDesc();
    }
}
