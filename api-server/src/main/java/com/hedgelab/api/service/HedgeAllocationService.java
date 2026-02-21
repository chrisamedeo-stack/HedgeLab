package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateHedgeAllocationRequest;
import com.hedgelab.api.dto.response.HedgeAllocationResponse;
import com.hedgelab.api.entity.HedgeAllocation;
import com.hedgelab.api.entity.HedgeTrade;
import com.hedgelab.api.entity.Site;
import com.hedgelab.api.repository.HedgeAllocationRepository;
import com.hedgelab.api.repository.HedgeTradeRepository;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HedgeAllocationService {

    private static final double BUSHELS_PER_LOT = 5_000.0;
    private static final double BUSHELS_PER_MT  = 39.3683;

    private final HedgeAllocationRepository allocationRepo;
    private final HedgeTradeRepository      hedgeRepo;
    private final SiteRepository            siteRepo;

    @Transactional(readOnly = true)
    public List<HedgeAllocationResponse> getAllocationsForTrade(Long tradeId) {
        return allocationRepo.findByHedgeTrade_IdOrderByBudgetMonthAsc(tradeId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public HedgeAllocationResponse create(Long tradeId, CreateHedgeAllocationRequest req) {
        HedgeTrade trade = hedgeRepo.findById(tradeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Hedge trade not found: " + tradeId));

        // Resolve site (nullable for month-only allocations)
        Site site = null;
        if (req.getSiteCode() != null && !req.getSiteCode().isBlank()) {
            site = siteRepo.findByCode(req.getSiteCode())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Site not found: " + req.getSiteCode()));
        }

        int alreadyAllocated = allocationRepo.sumAllocatedLotsByTradeId(tradeId);
        int newTotal = alreadyAllocated + req.getAllocatedLots();
        if (newTotal > trade.getLots()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Cannot allocate %d lots — only %d available (%d total, %d already allocated)",
                            req.getAllocatedLots(), trade.getLots() - alreadyAllocated,
                            trade.getLots(), alreadyAllocated));
        }

        HedgeAllocation allocation = HedgeAllocation.builder()
                .hedgeTrade(trade)
                .site(site)
                .budgetMonth(req.getBudgetMonth())
                .allocatedLots(req.getAllocatedLots())
                .notes(req.getNotes())
                .build();

        return toResponse(allocationRepo.save(allocation));
    }

    @Transactional
    public HedgeAllocationResponse assignSite(Long monthAllocationId, String siteCode, Integer lots) {
        // 1. Find the month-only allocation
        HedgeAllocation monthAlloc = allocationRepo.findById(monthAllocationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Allocation not found: " + monthAllocationId));

        // 2. Validate it IS a month-only allocation (site == null)
        if (monthAlloc.getSite() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Allocation " + monthAllocationId + " already has a site assigned");
        }

        // 3. Look up the Site
        Site site = siteRepo.findByCode(siteCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Site not found: " + siteCode));

        // 4. Validate lots
        if (lots == null || lots <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lots must be greater than 0");
        }
        if (lots > monthAlloc.getAllocatedLots()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Cannot assign %d lots — only %d available in month allocation",
                            lots, monthAlloc.getAllocatedLots()));
        }

        // 5. Create new site allocation
        HedgeAllocation siteAlloc = HedgeAllocation.builder()
                .hedgeTrade(monthAlloc.getHedgeTrade())
                .site(site)
                .budgetMonth(monthAlloc.getBudgetMonth())
                .allocatedLots(lots)
                .notes(monthAlloc.getNotes())
                .build();
        HedgeAllocation saved = allocationRepo.save(siteAlloc);

        // 6. Reduce or delete month-only allocation
        int remaining = monthAlloc.getAllocatedLots() - lots;
        if (remaining <= 0) {
            allocationRepo.delete(monthAlloc);
        } else {
            monthAlloc.setAllocatedLots(remaining);
            allocationRepo.save(monthAlloc);
        }

        // 7. Return the new site allocation
        return toResponse(saved);
    }

    @Transactional
    public void delete(Long allocationId) {
        HedgeAllocation a = allocationRepo.findById(allocationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Allocation not found: " + allocationId));
        allocationRepo.delete(a);
    }

    private HedgeAllocationResponse toResponse(HedgeAllocation a) {
        double mt = (a.getAllocatedLots() * BUSHELS_PER_LOT) / BUSHELS_PER_MT;
        return HedgeAllocationResponse.builder()
                .id(a.getId())
                .hedgeTradeId(a.getHedgeTrade().getId())
                .tradeRef(a.getHedgeTrade().getTradeRef())
                .siteCode(a.getSite() != null ? a.getSite().getCode() : null)
                .siteName(a.getSite() != null ? a.getSite().getName() : null)
                .budgetMonth(a.getBudgetMonth())
                .allocatedLots(a.getAllocatedLots())
                .allocatedMt(mt)
                .notes(a.getNotes())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
