package com.hedgelab.api.service;

import com.hedgelab.api.config.MarketDataFeedProperties;
import com.hedgelab.api.dto.request.PublishDailyPriceRequest;
import com.hedgelab.api.dto.response.DailyPriceResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Orchestrates fetching prices from CommodityPriceAPI and publishing them
 * to the internal market data store via MarketDataService.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PriceFeedService {

    private static final String SOURCE = "COMMODITY_PRICE_API";

    private final CommodityPriceApiClient apiClient;
    private final MarketDataService marketDataService;
    private final MarketDataFeedProperties feedProps;

    /**
     * Fetch latest prices for all configured symbols and publish them.
     *
     * @return summary map with published count and any failures
     */
    public Map<String, Object> fetchAndPublishLatest() {
        if (!feedProps.isConfigured()) {
            log.warn("[PriceFeed] API key not configured — skipping price fetch");
            return Map.of("status", "skipped", "reason", "API key not configured");
        }

        Map<String, String> symbolMap = feedProps.getSymbolMap();
        List<String> apiSymbols = new ArrayList<>(symbolMap.values());
        Map<String, String> reverseMap = feedProps.getReverseSymbolMap();

        Map<String, BigDecimal> prices = apiClient.fetchLatestPrices(apiSymbols);

        if (prices.isEmpty()) {
            log.warn("[PriceFeed] No prices returned from API");
            return Map.of("status", "empty", "published", 0);
        }

        LocalDate today = LocalDate.now();
        List<PublishDailyPriceRequest> requests = new ArrayList<>();
        List<String> failures = new ArrayList<>();

        for (Map.Entry<String, BigDecimal> entry : prices.entrySet()) {
            String indexCode = reverseMap.get(entry.getKey());
            if (indexCode == null) {
                log.warn("[PriceFeed] No mapping for API symbol: {}", entry.getKey());
                failures.add(entry.getKey());
                continue;
            }
            requests.add(new PublishDailyPriceRequest(
                    indexCode, today, entry.getValue(), "SETTLE", SOURCE));
        }

        List<DailyPriceResponse> published = marketDataService.publishPriceBatch(requests);
        log.info("[PriceFeed] Published {} prices for {}", published.size(), today);

        return Map.of(
                "status", "ok",
                "date", today.toString(),
                "published", published.size(),
                "failures", failures
        );
    }

    /**
     * Backfill historical prices for a date range.
     */
    public Map<String, Object> backfillHistory(LocalDate from, LocalDate to) {
        if (!feedProps.isConfigured()) {
            return Map.of("status", "skipped", "reason", "API key not configured");
        }

        Map<String, String> symbolMap = feedProps.getSymbolMap();
        List<String> apiSymbols = new ArrayList<>(symbolMap.values());
        Map<String, String> reverseMap = feedProps.getReverseSymbolMap();

        int totalPublished = 0;
        LocalDate date = from;

        while (!date.isAfter(to)) {
            // Skip weekends
            if (date.getDayOfWeek().getValue() >= 6) {
                date = date.plusDays(1);
                continue;
            }

            Map<String, BigDecimal> prices = apiClient.fetchHistoricalPrices(apiSymbols, date);

            List<PublishDailyPriceRequest> requests = new ArrayList<>();
            for (Map.Entry<String, BigDecimal> entry : prices.entrySet()) {
                String indexCode = reverseMap.get(entry.getKey());
                if (indexCode != null) {
                    requests.add(new PublishDailyPriceRequest(
                            indexCode, date, entry.getValue(), "SETTLE", SOURCE));
                }
            }

            if (!requests.isEmpty()) {
                marketDataService.publishPriceBatch(requests);
                totalPublished += requests.size();
            }

            date = date.plusDays(1);
        }

        log.info("[PriceFeed] Backfill complete: {} prices from {} to {}", totalPublished, from, to);
        return Map.of(
                "status", "ok",
                "from", from.toString(),
                "to", to.toString(),
                "published", totalPublished
        );
    }
}
