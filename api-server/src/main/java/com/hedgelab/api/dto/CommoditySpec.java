package com.hedgelab.api.dto;

import com.hedgelab.api.entity.Commodity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * Immutable snapshot of a commodity's contract specifications.
 * Used throughout services to avoid repeated DB lookups.
 */
public record CommoditySpec(
    String code,
    String slug,
    String exchange,
    String futuresPrefix,
    int contractSizeBu,
    BigDecimal bushelsPerMt,
    List<String> contractMonths,
    Map<String, List<Integer>> monthMappings
) {
    public static CommoditySpec from(Commodity c) {
        return new CommoditySpec(
            c.getCode(),
            c.getSlug(),
            c.getExchange(),
            c.getFuturesPrefix(),
            c.getContractSizeBu() != null ? c.getContractSizeBu() : 0,
            c.getBushelsPerMt() != null ? c.getBushelsPerMt() : BigDecimal.ZERO,
            c.getContractMonths() != null ? List.copyOf(c.getContractMonths()) : List.of(),
            c.getMonthMappings() != null ? Map.copyOf(c.getMonthMappings()) : Map.of()
        );
    }

    /**
     * Returns the calendar month number (1-12) for a given futures month letter.
     * E.g. H→3, K→5, N→7, U→9, Z→12, F→1, Q→8, X→11
     */
    public int getContractMonthNumber(char monthCode) {
        return switch (monthCode) {
            case 'F' -> 1;
            case 'G' -> 2;
            case 'H' -> 3;
            case 'J' -> 4;
            case 'K' -> 5;
            case 'M' -> 6;
            case 'N' -> 7;
            case 'Q' -> 8;
            case 'U' -> 9;
            case 'V' -> 10;
            case 'X' -> 11;
            case 'Z' -> 12;
            default -> 12;
        };
    }
}
