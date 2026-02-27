package com.hedgelab.api.service;

import com.hedgelab.api.config.MarketDataFeedProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * HTTP client for CommodityPriceAPI.com v2.
 * Calls /rates/latest and /rates/historical endpoints to retrieve settlement prices.
 */
@Slf4j
@Service
public class CommodityPriceApiClient {

    private final RestClient restClient;
    private final String apiKey;

    public CommodityPriceApiClient(MarketDataFeedProperties props) {
        this.apiKey = props.getApiKey() != null ? props.getApiKey() : "";
        this.restClient = RestClient.builder()
                .baseUrl(props.getBaseUrl())
                .build();
    }

    /**
     * Fetch current prices for the given API symbols.
     * GET /rates/latest?apiKey=...&symbols=BRENTOIL-FUT,WTIOIL-FUT,...
     *
     * Response: { "rates": { "BRENTOIL-FUT": 73.1, ... } }
     *
     * @return map of API symbol → price
     */
    public Map<String, BigDecimal> fetchLatestPrices(List<String> symbols) {
        String symbolParam = String.join(",", symbols);
        log.info("[PriceFeed] Fetching latest prices for: {}", symbolParam);

        return callLatestEndpoint(symbolParam);
    }

    /**
     * Fetch historical close prices for a specific date.
     * GET /rates/historical?apiKey=...&symbols=...&date=YYYY-MM-DD
     *
     * Response: { "rates": { "BRENTOIL-FUT": { "close": 70.88, ... } } }
     */
    public Map<String, BigDecimal> fetchHistoricalPrices(List<String> symbols, LocalDate date) {
        String symbolParam = String.join(",", symbols);
        log.info("[PriceFeed] Fetching historical prices for {} on {}", symbolParam, date);

        return callHistoricalEndpoint(symbolParam, date);
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> callLatestEndpoint(String symbols) {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/rates/latest?apiKey={apiKey}&symbols={symbols}",
                            Map.of("apiKey", apiKey, "symbols", symbols))
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        log.error("[PriceFeed] Client error {}: {}", res.getStatusCode(), res.getStatusText());
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        log.error("[PriceFeed] Server error {}: {}", res.getStatusCode(), res.getStatusText());
                    })
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !response.containsKey("rates")) {
                log.warn("[PriceFeed] Unexpected response structure: {}", response);
                return Collections.emptyMap();
            }

            Map<String, Object> rates = (Map<String, Object>) response.get("rates");
            return rates.entrySet().stream()
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            e -> new BigDecimal(e.getValue().toString())
                    ));
        } catch (Exception e) {
            log.error("[PriceFeed] API call failed: {}", e.getMessage(), e);
            return Collections.emptyMap();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, BigDecimal> callHistoricalEndpoint(String symbols, LocalDate date) {
        try {
            Map<String, Object> response = restClient.get()
                    .uri("/rates/historical?apiKey={apiKey}&symbols={symbols}&date={date}",
                            Map.of("apiKey", apiKey, "symbols", symbols, "date", date.toString()))
                    .retrieve()
                    .onStatus(HttpStatusCode::is4xxClientError, (req, res) -> {
                        log.error("[PriceFeed] Client error {}: {}", res.getStatusCode(), res.getStatusText());
                    })
                    .onStatus(HttpStatusCode::is5xxServerError, (req, res) -> {
                        log.error("[PriceFeed] Server error {}: {}", res.getStatusCode(), res.getStatusText());
                    })
                    .body(new ParameterizedTypeReference<>() {});

            if (response == null || !response.containsKey("rates")) {
                log.warn("[PriceFeed] Unexpected response structure: {}", response);
                return Collections.emptyMap();
            }

            // Historical response: { "rates": { "SYM": { "close": 70.88, ... } } }
            Map<String, Object> rates = (Map<String, Object>) response.get("rates");
            return rates.entrySet().stream()
                    .collect(Collectors.toMap(
                            Map.Entry::getKey,
                            e -> {
                                Map<String, Object> ohlc = (Map<String, Object>) e.getValue();
                                return new BigDecimal(ohlc.get("close").toString());
                            }
                    ));
        } catch (Exception e) {
            log.error("[PriceFeed] API call failed: {}", e.getMessage(), e);
            return Collections.emptyMap();
        }
    }
}
