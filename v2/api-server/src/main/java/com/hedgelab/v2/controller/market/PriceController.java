package com.hedgelab.v2.controller.market;

import com.hedgelab.v2.entity.market.MarketPrice;
import com.hedgelab.v2.service.market.MarketDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v2/market/prices")
@RequiredArgsConstructor
public class PriceController {

    private final MarketDataService marketDataService;

    @GetMapping
    public List<MarketPrice> list(@RequestParam(required = false) String commodityId,
                                   @RequestParam(required = false) String contractMonth,
                                   @RequestParam(required = false) String dateFrom,
                                   @RequestParam(required = false) String dateTo,
                                   @RequestParam(required = false) String priceType) {
        LocalDate from = dateFrom != null ? LocalDate.parse(dateFrom) : null;
        LocalDate to = dateTo != null ? LocalDate.parse(dateTo) : null;
        return marketDataService.listPrices(commodityId, contractMonth, from, to, priceType);
    }

    @GetMapping("/latest")
    public Object latest(@RequestParam String commodityId,
                          @RequestParam(required = false) String contractMonth) {
        if (contractMonth != null) {
            return marketDataService.getLatestPrice(commodityId, contractMonth).orElse(null);
        }
        return marketDataService.getLatestPrices(commodityId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Object create(@RequestBody Object body) {
        if (body instanceof List<?> list) {
            @SuppressWarnings("unchecked")
            List<MarketPrice> prices = (List<MarketPrice>) list;
            return marketDataService.createPrices(prices);
        }
        return marketDataService.createPrice((MarketPrice) body);
    }
}
