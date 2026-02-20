package com.hedgelab.api.util;

import java.util.List;

/**
 * Maps CBOT ZC futures month codes to valid physical delivery months.
 *
 * Convention:
 *   ZCH → Dec(Y-1), Jan(Y), Feb(Y)
 *   ZCK → Mar(Y), Apr(Y)
 *   ZCN → May(Y), Jun(Y)
 *   ZCU → Jul(Y), Aug(Y)
 *   ZCZ → Sep(Y), Oct(Y), Nov(Y)
 *
 * Code format: ZC<MonthLetter><2-digit-year>  e.g. ZCN26
 */
public final class ZcMonthMapper {

    private ZcMonthMapper() {}

    /**
     * Returns the list of YYYY-MM delivery months that a given futures code
     * can legitimately cover via EFP.
     */
    public static List<String> getValidDeliveryMonths(String futuresMonth) {
        if (futuresMonth == null || futuresMonth.length() < 5) return List.of();

        String upper = futuresMonth.toUpperCase();
        // Expect format ZC<X><YY>  e.g. ZCN26
        if (!upper.startsWith("ZC") || upper.length() < 5) return List.of();

        char monthCode = upper.charAt(2);
        String yearStr = upper.substring(3);
        int year;
        try {
            year = 2000 + Integer.parseInt(yearStr);
        } catch (NumberFormatException e) {
            return List.of();
        }

        return switch (monthCode) {
            case 'H' -> List.of(
                    String.format("%d-12", year - 1),
                    String.format("%d-01", year),
                    String.format("%d-02", year));
            case 'K' -> List.of(
                    String.format("%d-03", year),
                    String.format("%d-04", year));
            case 'N' -> List.of(
                    String.format("%d-05", year),
                    String.format("%d-06", year));
            case 'U' -> List.of(
                    String.format("%d-07", year),
                    String.format("%d-08", year));
            case 'Z' -> List.of(
                    String.format("%d-09", year),
                    String.format("%d-10", year),
                    String.format("%d-11", year));
            default -> List.of();
        };
    }
}
