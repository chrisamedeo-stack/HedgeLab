package com.hedgelab.v2.controller.trade;

import com.hedgelab.v2.entity.trade.FinancialTrade;
import com.hedgelab.v2.service.trade.TradeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/v2/trades")
@RequiredArgsConstructor
public class TradeController {

    private final TradeService tradeService;

    @GetMapping
    public List<FinancialTrade> list(@RequestParam UUID orgId,
                                      @RequestParam(required = false) String commodityId,
                                      @RequestParam(required = false) String status,
                                      @RequestParam(required = false) String contractMonth,
                                      @RequestParam(required = false) String dateFrom,
                                      @RequestParam(required = false) String dateTo) {
        LocalDate from = dateFrom != null ? LocalDate.parse(dateFrom) : null;
        LocalDate to = dateTo != null ? LocalDate.parse(dateTo) : null;
        return tradeService.list(orgId, commodityId, status, contractMonth, from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FinancialTrade create(@RequestBody FinancialTrade trade) {
        return tradeService.create(trade);
    }

    @PostMapping("/batch")
    @ResponseStatus(HttpStatus.CREATED)
    public List<FinancialTrade> createBatch(@RequestBody List<FinancialTrade> trades) {
        return trades.stream().map(tradeService::create).toList();
    }

    @GetMapping("/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        return tradeService.getWithAllocations(id);
    }

    @PatchMapping("/{id}")
    @SuppressWarnings("unchecked")
    public FinancialTrade update(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        UUID userId = body.containsKey("userId") ? UUID.fromString((String) body.get("userId")) : null;
        Map<String, Object> changes = new LinkedHashMap<>(body);
        changes.remove("userId");
        return tradeService.update(id, userId, changes);
    }

    @DeleteMapping("/{id}")
    public FinancialTrade cancel(@PathVariable UUID id,
                                  @RequestParam String userId,
                                  @RequestParam(required = false) String reason) {
        return tradeService.cancel(id, UUID.fromString(userId), reason);
    }
}
