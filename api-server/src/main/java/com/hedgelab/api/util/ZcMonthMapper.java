package com.hedgelab.api.util;

import com.hedgelab.api.service.AppSettingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Maps CBOT ZC futures month codes to valid physical delivery months.
 *
 * Convention (default, configurable via app_settings):
 *   ZCH → Dec(Y-1), Jan(Y), Feb(Y)
 *   ZCK → Mar(Y), Apr(Y)
 *   ZCN → May(Y), Jun(Y)
 *   ZCU → Jul(Y), Aug(Y)
 *   ZCZ → Sep(Y), Oct(Y), Nov(Y)
 *
 * Code format: ZC<MonthLetter><2-digit-year>  e.g. ZCN26
 */
@Component
@RequiredArgsConstructor
public class ZcMonthMapper {

    private final AppSettingService appSettingService;

    /**
     * Returns the list of YYYY-MM delivery months that a given futures code
     * can legitimately cover via EFP.
     */
    public List<String> getValidDeliveryMonths(String futuresMonth) {
        if (futuresMonth == null || futuresMonth.length() < 5) return List.of();

        String upper = futuresMonth.toUpperCase();
        if (!upper.startsWith("ZC") || upper.length() < 5) return List.of();

        char monthCode = upper.charAt(2);
        String yearStr = upper.substring(3);
        int year;
        try {
            year = 2000 + Integer.parseInt(yearStr);
        } catch (NumberFormatException e) {
            return List.of();
        }

        Map<String, List<Integer>> mappings = appSettingService.getFuturesMonthMappings();
        List<Integer> months = mappings.get(String.valueOf(monthCode));
        if (months == null || months.isEmpty()) return List.of();

        List<String> result = new ArrayList<>();
        for (int m : months) {
            // Month 12 mapped to a letter like H (March contract) means Dec of previous year
            int y = (m == 12 && monthCode == 'H') ? year - 1 : year;
            // More generally: if the delivery month is >= the contract's own month number,
            // it might be the previous year. Use the H-specific rule: if any month is
            // greater than the last month in the mapping, assume previous year.
            // Simpler: for months where the delivery month > contract expiry month,
            // shift to previous year. The H contract (March = month 3) covers Dec(12).
            // We detect this by checking if the month number is larger than the contract month.
            int contractMonth = getContractMonth(monthCode);
            if (m > contractMonth) {
                y = year - 1;
            }
            result.add(String.format("%d-%02d", y, m));
        }
        return result;
    }

    private int getContractMonth(char code) {
        return switch (code) {
            case 'H' -> 3;
            case 'K' -> 5;
            case 'N' -> 7;
            case 'U' -> 9;
            case 'Z' -> 12;
            default -> 12;
        };
    }
}
