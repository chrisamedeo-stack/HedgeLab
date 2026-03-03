package com.hedgelab.v2.service.trade;

import com.hedgelab.v2.entity.position.Allocation;
import com.hedgelab.v2.entity.trade.FinancialTrade;
import com.hedgelab.v2.exception.InvalidStateException;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.position.AllocationRepository;
import com.hedgelab.v2.repository.trade.FinancialTradeRepository;
import com.hedgelab.v2.service.kernel.AuditService;
import com.hedgelab.v2.service.kernel.EventBusService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final FinancialTradeRepository tradeRepo;
    private final AllocationRepository allocationRepo;
    private final AuditService auditService;
    private final EventBusService eventBusService;

    public List<FinancialTrade> list(UUID orgId, String commodityId, String status,
                                      String contractMonth, LocalDate dateFrom, LocalDate dateTo) {
        return tradeRepo.findFiltered(orgId, commodityId, status, contractMonth, dateFrom, dateTo);
    }

    public FinancialTrade getById(UUID id) {
        return tradeRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Trade", id));
    }

    public Map<String, Object> getWithAllocations(UUID tradeId) {
        FinancialTrade trade = getById(tradeId);
        List<Allocation> allocations = allocationRepo.findByTradeIdAndStatusNot(tradeId, "cancelled");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("trade", trade);
        result.put("allocations", allocations);
        return result;
    }

    @Transactional
    public FinancialTrade create(FinancialTrade trade) {
        trade.setStatus("open");
        trade.setAllocatedVolume(BigDecimal.ZERO);
        FinancialTrade saved = tradeRepo.save(trade);

        auditService.log(trade.getOrgId(), trade.getEnteredBy(), "trade_capture", "trade",
                saved.getId().toString(), "create", null, null, "api", null);

        eventBusService.emit(EventBusService.TRADE_CREATED, "trade_capture",
                "trade", saved.getId().toString(),
                Map.of("commodityId", saved.getCommodityId(),
                       "direction", saved.getDirection(),
                       "volume", saved.getNumContracts() * saved.getContractSize().doubleValue()),
                saved.getOrgId(), saved.getEnteredBy());

        return saved;
    }

    @Transactional
    public FinancialTrade update(UUID tradeId, UUID userId, Map<String, Object> changes) {
        FinancialTrade trade = getById(tradeId);
        if ("cancelled".equals(trade.getStatus())) {
            throw new InvalidStateException("Cannot update cancelled trade");
        }

        if (changes.containsKey("broker")) trade.setBroker((String) changes.get("broker"));
        if (changes.containsKey("accountNumber")) trade.setAccountNumber((String) changes.get("accountNumber"));
        if (changes.containsKey("notes")) trade.setNotes((String) changes.get("notes"));
        if (changes.containsKey("commission")) trade.setCommission(new BigDecimal(changes.get("commission").toString()));
        if (changes.containsKey("fees")) trade.setFees(new BigDecimal(changes.get("fees").toString()));
        if (changes.containsKey("externalRef")) trade.setExternalRef((String) changes.get("externalRef"));
        trade.setUpdatedAt(Instant.now());

        FinancialTrade saved = tradeRepo.save(trade);

        auditService.log(trade.getOrgId(), userId, "trade_capture", "trade",
                tradeId.toString(), "update", null, null, "api", null);

        eventBusService.emit(EventBusService.TRADE_UPDATED, "trade_capture",
                "trade", tradeId.toString(), Map.of("changes", changes),
                trade.getOrgId(), userId);

        return saved;
    }

    @Transactional
    public FinancialTrade cancel(UUID tradeId, UUID userId, String reason) {
        FinancialTrade trade = getById(tradeId);
        if ("cancelled".equals(trade.getStatus())) {
            throw new InvalidStateException("Trade already cancelled");
        }

        String appendNote = "Cancelled" + (reason != null ? ": " + reason : "");
        trade.setStatus("cancelled");
        trade.setNotes(trade.getNotes() != null ? trade.getNotes() + "\n" + appendNote : appendNote);
        trade.setUpdatedAt(Instant.now());
        FinancialTrade saved = tradeRepo.save(trade);

        auditService.log(trade.getOrgId(), userId, "trade_capture", "trade",
                tradeId.toString(), "cancel", null, null, "api", reason);

        eventBusService.emit(EventBusService.TRADE_CANCELLED, "trade_capture",
                "trade", tradeId.toString(), Map.of("reason", reason != null ? reason : ""),
                trade.getOrgId(), userId);

        return saved;
    }
}
