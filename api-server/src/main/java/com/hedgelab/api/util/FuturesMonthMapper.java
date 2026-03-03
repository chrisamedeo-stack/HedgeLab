package com.hedgelab.api.util;

import com.hedgelab.api.dto.CommoditySpec;
import com.hedgelab.api.service.CommoditySpecService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Generalized futures month mapper that uses CommoditySpec instead of hardcoded ZC mappings.
 * Replaces ZcMonthMapper — works for any commodity with month_mappings defined.
 */
@Component
@RequiredArgsConstructor
public class FuturesMonthMapper {

    private final CommoditySpecService specService;

    /**
     * Returns the list of YYYY-MM delivery months that a given futures code covers.
     * Auto-detects commodity from futures prefix (e.g., ZCN26 → corn, ZSN26 → soybean).
     */
    public List<String> getValidDeliveryMonths(String futuresMonth) {
        if (futuresMonth == null || futuresMonth.length() < 4) return List.of();

        String upper = futuresMonth.toUpperCase();
        CommoditySpec spec;
        try {
            spec = specService.getSpecByFuturesPrefix(upper);
        } catch (Exception e) {
            return List.of();
        }

        String prefix = spec.futuresPrefix();
        if (!upper.startsWith(prefix)) return List.of();

        // Parse month letter and year from the code after the prefix
        int prefixLen = prefix.length();
        if (upper.length() < prefixLen + 3) return List.of();

        char monthCode = upper.charAt(prefixLen);
        String yearStr = upper.substring(prefixLen + 1);
        int year;
        try {
            year = 2000 + Integer.parseInt(yearStr);
        } catch (NumberFormatException e) {
            return List.of();
        }

        Map<String, List<Integer>> mappings = spec.monthMappings();
        List<Integer> months = mappings.get(String.valueOf(monthCode));
        if (months == null || months.isEmpty()) return List.of();

        int contractMonth = spec.getContractMonthNumber(monthCode);

        List<String> result = new ArrayList<>();
        for (int m : months) {
            int y = (m > contractMonth) ? year - 1 : year;
            result.add(String.format("%d-%02d", y, m));
        }
        return result;
    }

    /**
     * Returns valid delivery months using the old ZcMonthMapper-compatible interface.
     * Delegates to the generic implementation.
     */
    public List<String> getValidDeliveryMonthsForCorn(String futuresMonth) {
        return getValidDeliveryMonths(futuresMonth);
    }
}
