package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreatePriceIndexRequest;
import com.hedgelab.api.dto.request.PublishDailyPriceRequest;
import com.hedgelab.api.dto.response.DailyPriceResponse;
import com.hedgelab.api.dto.response.ForwardCurveResponse;
import com.hedgelab.api.dto.response.PriceIndexResponse;
import com.hedgelab.api.service.MarketDataService;
import com.hedgelab.api.service.PriceIndexService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/market-data")
@RequiredArgsConstructor
@Tag(name = "Market Data", description = "Price indices, daily prices, and forward curves")
public class MarketDataController {

    private final MarketDataService marketDataService;
    private final PriceIndexService priceIndexService;

    // --- Price Index endpoints ---

    @PostMapping("/indices")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a price index")
    public PriceIndexResponse createIndex(@Valid @RequestBody CreatePriceIndexRequest req) {
        return priceIndexService.create(req);
    }

    @GetMapping("/indices")
    @Operation(summary = "List all active price indices")
    public List<PriceIndexResponse> listIndices() {
        return priceIndexService.getAll();
    }

    @GetMapping("/indices/{code}")
    @Operation(summary = "Get price index by code")
    public PriceIndexResponse getIndex(@PathVariable String code) {
        return priceIndexService.getByCode(code);
    }

    @GetMapping("/indices/by-commodity/{commodityId}")
    @Operation(summary = "Get indices by commodity")
    public List<PriceIndexResponse> getIndicesByCommodity(@PathVariable Long commodityId) {
        return priceIndexService.getByCommodity(commodityId);
    }

    // --- Daily Price endpoints ---

    @PostMapping("/prices")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Publish a daily settlement price")
    public DailyPriceResponse publishPrice(@Valid @RequestBody PublishDailyPriceRequest req) {
        return marketDataService.publishPrice(req);
    }

    @PostMapping("/prices/batch")
    @Operation(summary = "Bulk publish daily prices")
    public List<DailyPriceResponse> publishPriceBatch(@Valid @RequestBody List<PublishDailyPriceRequest> requests) {
        return marketDataService.publishPriceBatch(requests);
    }

    @GetMapping("/prices/{indexCode}/latest")
    @Operation(summary = "Get latest confirmed price for an index")
    public DailyPriceResponse getLatestPrice(@PathVariable String indexCode) {
        return marketDataService.getLatestPrice(indexCode);
    }

    @GetMapping("/prices/{indexCode}")
    @Operation(summary = "Get price for a specific date")
    public DailyPriceResponse getPriceForDate(
            @PathVariable String indexCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return marketDataService.getPriceForDate(indexCode, date);
    }

    @GetMapping("/prices/{indexCode}/history")
    @Operation(summary = "Get price history for a date range")
    public List<DailyPriceResponse> getPriceHistory(
            @PathVariable String indexCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return marketDataService.getPriceHistory(indexCode, from, to);
    }

    // --- Forward Curve endpoints ---

    @PostMapping("/forward-curves/{indexCode}")
    @Operation(summary = "Publish a forward curve (map of YYYY-MM → price)")
    public Map<String, Object> publishForwardCurve(
            @PathVariable String indexCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate curveDate,
            @RequestBody Map<String, BigDecimal> points) {
        Map<YearMonth, BigDecimal> parsed = points.entrySet().stream()
            .collect(Collectors.toMap(e -> YearMonth.parse(e.getKey()), Map.Entry::getValue));
        int saved = marketDataService.publishForwardCurve(indexCode, curveDate, parsed);
        return Map.of("pointsSaved", saved);
    }

    @GetMapping("/forward-curves/{indexCode}")
    @Operation(summary = "Get forward curve as of a date")
    public List<ForwardCurveResponse> getForwardCurve(
            @PathVariable String indexCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate curveDate) {
        return marketDataService.getForwardCurve(indexCode, curveDate);
    }
}
