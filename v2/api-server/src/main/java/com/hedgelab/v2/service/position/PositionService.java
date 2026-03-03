package com.hedgelab.v2.service.position;

import com.hedgelab.v2.entity.position.*;
import com.hedgelab.v2.exception.InvalidStateException;
import com.hedgelab.v2.exception.ResourceNotFoundException;
import com.hedgelab.v2.repository.position.*;
import com.hedgelab.v2.service.kernel.AuditService;
import com.hedgelab.v2.service.kernel.EventBusService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PositionService {

    private final AllocationRepository allocationRepo;
    private final LockedPositionRepository lockedRepo;
    private final PhysicalPositionRepository physicalRepo;
    private final RolloverRepository rolloverRepo;
    private final RolloverLegRepository rolloverLegRepo;
    private final RolloverCostRepository rolloverCostRepo;
    private final AuditService auditService;
    private final EventBusService eventBusService;

    // ---- Allocations ----

    public List<Allocation> listAllocations(UUID orgId, UUID siteId, String commodityId,
                                             String status, String contractMonth, String budgetMonth) {
        return allocationRepo.findFiltered(orgId, siteId, commodityId, status, contractMonth, budgetMonth);
    }

    @Transactional
    public Allocation allocateToSite(Allocation alloc) {
        alloc.setStatus("open");
        alloc.setAllocationDate(LocalDate.now());
        Allocation saved = allocationRepo.save(alloc);

        auditService.log(alloc.getOrgId(), alloc.getAllocatedBy(), "position_manager", "allocation",
                saved.getId().toString(), "create", null, null, "api", null);

        eventBusService.emit(EventBusService.POSITION_ALLOCATED, "position_manager",
                "allocation", saved.getId().toString(),
                Map.of("siteId", saved.getSiteId().toString(),
                       "commodityId", saved.getCommodityId(),
                       "volume", saved.getAllocatedVolume(),
                       "budgetMonth", saved.getBudgetMonth() != null ? saved.getBudgetMonth() : "",
                       "tradePrice", saved.getTradePrice() != null ? saved.getTradePrice() : BigDecimal.ZERO),
                saved.getOrgId(), alloc.getAllocatedBy());

        return saved;
    }

    public Allocation getAllocation(UUID id) {
        return allocationRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Allocation", id));
    }

    @Transactional
    public Allocation updateAllocation(UUID id, UUID userId, String budgetMonth, String notes, UUID siteId) {
        Allocation a = getAllocation(id);
        if (!"open".equals(a.getStatus())) {
            throw new InvalidStateException("Cannot update allocation with status: " + a.getStatus());
        }
        if (budgetMonth != null) a.setBudgetMonth(budgetMonth);
        if (notes != null) a.setNotes(notes);
        if (siteId != null) a.setSiteId(siteId);
        return allocationRepo.save(a);
    }

    @Transactional
    public Allocation cancelAllocation(UUID id, UUID userId) {
        Allocation a = getAllocation(id);
        if (!"open".equals(a.getStatus())) {
            throw new InvalidStateException("Cannot cancel allocation with status: " + a.getStatus());
        }
        a.setStatus("cancelled");
        Allocation saved = allocationRepo.save(a);

        auditService.log(a.getOrgId(), userId, "position_manager", "allocation",
                id.toString(), "cancel", null, null, "api", null);

        eventBusService.emit(EventBusService.POSITION_DEALLOCATED, "position_manager",
                "allocation", id.toString(),
                Map.of("siteId", a.getSiteId().toString(),
                       "commodityId", a.getCommodityId(),
                       "volume", a.getAllocatedVolume(),
                       "budgetMonth", a.getBudgetMonth() != null ? a.getBudgetMonth() : ""),
                a.getOrgId(), userId);

        return saved;
    }

    // ---- EFP ----

    @Transactional
    public LockedPosition executeEFP(UUID allocationId, BigDecimal lockPrice,
                                     BigDecimal basisPrice, String deliveryMonth, UUID userId) {
        Allocation a = getAllocation(allocationId);
        if (!"open".equals(a.getStatus())) {
            throw new InvalidStateException("Cannot EFP allocation with status: " + a.getStatus());
        }

        BigDecimal futuresPnl = BigDecimal.ZERO;
        if (a.getTradePrice() != null) {
            futuresPnl = lockPrice.subtract(a.getTradePrice()).multiply(a.getAllocatedVolume());
            if ("short".equals(a.getDirection())) {
                futuresPnl = futuresPnl.negate();
            }
        }

        BigDecimal allInPrice = lockPrice;
        if (basisPrice != null) {
            allInPrice = lockPrice.add(basisPrice);
        }

        LockedPosition lp = LockedPosition.builder()
                .allocationId(allocationId)
                .siteId(a.getSiteId())
                .commodityId(a.getCommodityId())
                .volume(a.getAllocatedVolume())
                .lockedPrice(lockPrice)
                .futuresComponent(lockPrice)
                .basisComponent(basisPrice)
                .futuresPnl(futuresPnl)
                .allInPrice(allInPrice)
                .currency(a.getCurrency())
                .deliveryMonth(deliveryMonth)
                .build();
        LockedPosition saved = lockedRepo.save(lp);

        a.setStatus("efp_closed");
        a.setEfpDate(LocalDate.now());
        a.setEfpPrice(lockPrice);
        a.setEfpVolume(a.getAllocatedVolume());
        a.setFuturesPnl(futuresPnl);
        allocationRepo.save(a);

        eventBusService.emit(EventBusService.EFP_EXECUTED, "position_manager",
                "allocation", allocationId.toString(),
                Map.of("lockedPositionId", saved.getId().toString(),
                       "lockPrice", lockPrice, "volume", a.getAllocatedVolume()),
                a.getOrgId(), userId);

        return saved;
    }

    // ---- Offset ----

    @Transactional
    public Allocation executeOffset(UUID allocationId, BigDecimal offsetPrice, UUID userId) {
        Allocation a = getAllocation(allocationId);
        if (!"open".equals(a.getStatus())) {
            throw new InvalidStateException("Cannot offset allocation with status: " + a.getStatus());
        }

        BigDecimal pnl = BigDecimal.ZERO;
        if (a.getTradePrice() != null) {
            pnl = offsetPrice.subtract(a.getTradePrice()).multiply(a.getAllocatedVolume());
            if ("short".equals(a.getDirection())) {
                pnl = pnl.negate();
            }
        }

        a.setStatus("offset");
        a.setOffsetDate(LocalDate.now());
        a.setOffsetPrice(offsetPrice);
        a.setOffsetVolume(a.getAllocatedVolume());
        a.setOffsetPnl(pnl);
        Allocation saved = allocationRepo.save(a);

        eventBusService.emit(EventBusService.POSITION_OFFSET, "position_manager",
                "allocation", allocationId.toString(),
                Map.of("offsetPrice", offsetPrice, "pnl", pnl),
                a.getOrgId(), userId);

        return saved;
    }

    // ---- Roll ----

    @Transactional
    public Rollover executeRoll(UUID sourceAllocationId, BigDecimal closePrice, BigDecimal openPrice,
                                String openMonth, BigDecimal openVolume, BigDecimal commission,
                                BigDecimal fees, Boolean autoReallocate, UUID reallocationSiteId,
                                String reallocationBudgetMonth, String notes, UUID orgId, UUID userId) {
        Allocation source = getAllocation(sourceAllocationId);
        if (!"open".equals(source.getStatus())) {
            throw new InvalidStateException("Cannot roll allocation with status: " + source.getStatus());
        }

        BigDecimal vol = openVolume != null ? openVolume : source.getAllocatedVolume();
        BigDecimal realizedPnl = closePrice.subtract(source.getTradePrice() != null ? source.getTradePrice() : BigDecimal.ZERO)
                .multiply(source.getAllocatedVolume());
        if ("short".equals(source.getDirection())) {
            realizedPnl = realizedPnl.negate();
        }
        BigDecimal spreadPrice = openPrice.subtract(closePrice);
        BigDecimal spreadCost = spreadPrice.multiply(vol);

        Rollover roll = Rollover.builder()
                .orgId(orgId)
                .commodityId(source.getCommodityId())
                .status("executed")
                .closeMonth(source.getContractMonth())
                .closeVolume(source.getAllocatedVolume())
                .closePrice(closePrice)
                .closeRealizedPnl(realizedPnl)
                .openMonth(openMonth)
                .openVolume(vol)
                .openPrice(openPrice)
                .openTotalVolume(vol)
                .spreadPrice(spreadPrice)
                .spreadCost(spreadCost)
                .sourceType("allocation")
                .sourceAllocationId(sourceAllocationId)
                .autoReallocate(autoReallocate != null ? autoReallocate : false)
                .reallocationSiteId(reallocationSiteId)
                .reallocationBudgetMonth(reallocationBudgetMonth)
                .direction(source.getDirection())
                .executedBy(userId)
                .notes(notes)
                .build();
        Rollover savedRoll = rolloverRepo.save(roll);

        // Close leg
        rolloverLegRepo.save(RolloverLeg.builder()
                .rolloverId(savedRoll.getId())
                .legType("close")
                .commodityId(source.getCommodityId())
                .contractMonth(source.getContractMonth())
                .volume(source.getAllocatedVolume())
                .price(closePrice)
                .allocationId(sourceAllocationId)
                .realizedPnl(realizedPnl)
                .build());

        // Open leg
        rolloverLegRepo.save(RolloverLeg.builder()
                .rolloverId(savedRoll.getId())
                .legType("open")
                .commodityId(source.getCommodityId())
                .contractMonth(openMonth)
                .volume(vol)
                .price(openPrice)
                .build());

        // Costs
        BigDecimal totalCost = (commission != null ? commission : BigDecimal.ZERO)
                .add(fees != null ? fees : BigDecimal.ZERO)
                .add(spreadCost.abs());
        rolloverCostRepo.save(RolloverCost.builder()
                .rolloverId(savedRoll.getId())
                .spreadCost(spreadCost)
                .commission(commission != null ? commission : BigDecimal.ZERO)
                .fees(fees != null ? fees : BigDecimal.ZERO)
                .totalCost(totalCost)
                .siteId(source.getSiteId())
                .currency(source.getCurrency())
                .build());

        // Mark source as rolled
        source.setStatus("rolled");
        source.setRollId(savedRoll.getId());
        allocationRepo.save(source);

        // Create new allocation
        Allocation newAlloc = Allocation.builder()
                .orgId(orgId)
                .siteId(reallocationSiteId != null ? reallocationSiteId : source.getSiteId())
                .commodityId(source.getCommodityId())
                .allocatedVolume(vol)
                .budgetMonth(reallocationBudgetMonth != null ? reallocationBudgetMonth : source.getBudgetMonth())
                .tradePrice(openPrice)
                .tradeDate(LocalDate.now())
                .contractMonth(openMonth)
                .direction(source.getDirection())
                .currency(source.getCurrency())
                .rolledFromAllocationId(sourceAllocationId)
                .rollId(savedRoll.getId())
                .allocatedBy(userId)
                .notes("Rolled from " + source.getContractMonth() + " to " + openMonth)
                .build();
        Allocation savedAlloc = allocationRepo.save(newAlloc);

        savedRoll.setNewAllocationId(savedAlloc.getId());
        rolloverRepo.save(savedRoll);

        eventBusService.emit(EventBusService.POSITION_ROLLED, "position_manager",
                "rollover", savedRoll.getId().toString(),
                Map.of("sourceAllocationId", sourceAllocationId.toString(),
                       "newAllocationId", savedAlloc.getId().toString(),
                       "closeMonth", source.getContractMonth(),
                       "openMonth", openMonth),
                orgId, userId);

        return savedRoll;
    }

    // ---- Rollover Candidates ----

    public List<Allocation> getRolloverCandidates(UUID orgId, String commodityId) {
        return allocationRepo.findOpenByOrgId(orgId, commodityId);
    }

    // ---- Physical Positions ----

    public List<PhysicalPosition> listPhysicals(UUID orgId, UUID siteId, String commodityId, String status) {
        return physicalRepo.findFiltered(orgId, siteId, commodityId, status);
    }

    @Transactional
    public PhysicalPosition createPhysical(PhysicalPosition pos) {
        pos.setStatus("open");
        PhysicalPosition saved = physicalRepo.save(pos);

        eventBusService.emit(EventBusService.PHYSICAL_POSITION_CREATED, "position_manager",
                "physical_position", saved.getId().toString(),
                Map.of("siteId", saved.getSiteId().toString(),
                       "commodityId", saved.getCommodityId(),
                       "volume", saved.getVolume(),
                       "direction", saved.getDirection(),
                       "deliveryMonth", saved.getDeliveryMonth() != null ? saved.getDeliveryMonth() : ""),
                saved.getOrgId(), null);

        return saved;
    }

    // ---- Site View ----

    public Map<String, Object> getSitePosition(UUID siteId, String commodityId) {
        List<Allocation> hedges = commodityId != null
                ? allocationRepo.findBySiteIdAndCommodityIdAndStatusNot(siteId, commodityId, "cancelled")
                : allocationRepo.findBySiteIdAndStatusNot(siteId, "cancelled");

        List<PhysicalPosition> physicals = commodityId != null
                ? physicalRepo.findBySiteIdAndCommodityIdAndStatusNot(siteId, commodityId, "cancelled")
                : physicalRepo.findBySiteIdAndStatusNot(siteId, "cancelled");

        List<LockedPosition> locked = commodityId != null
                ? lockedRepo.findBySiteIdAndCommodityId(siteId, commodityId)
                : lockedRepo.findBySiteId(siteId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("hedges", hedges);
        result.put("physicals", physicals);
        result.put("locked", locked);
        result.put("siteId", siteId);
        return result;
    }

    // ---- Hedge Book ----

    public Map<String, Object> getHedgeBook(UUID orgId, String commodityId, UUID regionGroupId) {
        List<Allocation> entries = allocationRepo.findOpenByOrgId(orgId, commodityId);

        // Group by contract month
        Map<String, List<Allocation>> byMonth = entries.stream()
                .filter(a -> a.getContractMonth() != null)
                .collect(Collectors.groupingBy(Allocation::getContractMonth, TreeMap::new, Collectors.toList()));

        // KPIs
        long totalAllocations = entries.size();
        BigDecimal openVolume = entries.stream()
                .filter(a -> "open".equals(a.getStatus()))
                .map(Allocation::getAllocatedVolume)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal lockedVolume = entries.stream()
                .filter(a -> "efp_closed".equals(a.getStatus()))
                .map(Allocation::getAllocatedVolume)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal offsetVolume = entries.stream()
                .filter(a -> "offset".equals(a.getStatus()))
                .map(Allocation::getAllocatedVolume)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, Object> kpis = new LinkedHashMap<>();
        kpis.put("totalAllocations", totalAllocations);
        kpis.put("openVolume", openVolume);
        kpis.put("lockedVolume", lockedVolume);
        kpis.put("offsetVolume", offsetVolume);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("entries", entries);
        result.put("byMonth", byMonth);
        result.put("kpis", kpis);
        return result;
    }

    // ---- Locked Positions ----

    public List<LockedPosition> listLocked(UUID siteId, String commodityId) {
        if (siteId != null && commodityId != null) {
            return lockedRepo.findBySiteIdAndCommodityId(siteId, commodityId);
        }
        if (siteId != null) {
            return lockedRepo.findBySiteId(siteId);
        }
        return lockedRepo.findAll();
    }
}
