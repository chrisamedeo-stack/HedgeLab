package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateOffsetRequest;
import com.hedgelab.api.dto.response.HedgeOffsetResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HedgeOffsetService {

    private static final BigDecimal BUSHELS_PER_LOT = new BigDecimal("5000");
    private static final BigDecimal CENTS_PER_DOLLAR = new BigDecimal("100");

    private final HedgeOffsetRepository     offsetRepo;
    private final HedgeTradeRepository      hedgeRepo;
    private final HedgeAllocationRepository allocationRepo;

    @Transactional
    public HedgeOffsetResponse offsetFromPool(Long hedgeTradeId, CreateOffsetRequest req) {
        HedgeTrade hedge = hedgeRepo.findById(hedgeTradeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Hedge trade not found: " + hedgeTradeId));

        int allocatedLots = allocationRepo.sumAllocatedLotsByTradeId(hedgeTradeId);
        int unallocatedLots = hedge.getOpenLots() - allocatedLots;
        if (req.getLots() > unallocatedLots) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Cannot offset %d lots — only %d unallocated lots available",
                            req.getLots(), unallocatedLots));
        }

        BigDecimal entryPrice = hedge.getPricePerBushel();
        BigDecimal pnlCents = req.getExitPrice().subtract(entryPrice);
        BigDecimal pnlUsd = pnlCents
                .multiply(BUSHELS_PER_LOT)
                .multiply(BigDecimal.valueOf(req.getLots()))
                .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);

        HedgeOffset offset = HedgeOffset.builder()
                .hedgeTrade(hedge)
                .lots(req.getLots())
                .exitPrice(req.getExitPrice())
                .offsetDate(req.getOffsetDate())
                .realizedPnl(pnlUsd)
                .notes(req.getNotes())
                .build();

        hedge.setOpenLots(hedge.getOpenLots() - req.getLots());
        if (hedge.getOpenLots() <= 0) {
            hedge.setStatus(HedgeTradeStatus.CLOSED);
        }
        hedgeRepo.save(hedge);

        return toResponse(offsetRepo.save(offset));
    }

    @Transactional
    public HedgeOffsetResponse offsetFromAllocation(Long allocationId, CreateOffsetRequest req) {
        HedgeAllocation allocation = allocationRepo.findById(allocationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Allocation not found: " + allocationId));

        if (req.getLots() > allocation.getAllocatedLots()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    String.format("Cannot offset %d lots — allocation only has %d lots",
                            req.getLots(), allocation.getAllocatedLots()));
        }

        HedgeTrade hedge = allocation.getHedgeTrade();
        BigDecimal entryPrice = hedge.getPricePerBushel();
        BigDecimal pnlCents = req.getExitPrice().subtract(entryPrice);
        BigDecimal pnlUsd = pnlCents
                .multiply(BUSHELS_PER_LOT)
                .multiply(BigDecimal.valueOf(req.getLots()))
                .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);

        HedgeOffset offset = HedgeOffset.builder()
                .hedgeTrade(hedge)
                .site(allocation.getSite())
                .allocation(allocation)
                .lots(req.getLots())
                .exitPrice(req.getExitPrice())
                .offsetDate(req.getOffsetDate())
                .realizedPnl(pnlUsd)
                .notes(req.getNotes())
                .build();

        allocation.setAllocatedLots(allocation.getAllocatedLots() - req.getLots());
        if (allocation.getAllocatedLots() <= 0) {
            allocationRepo.delete(allocation);
        } else {
            allocationRepo.save(allocation);
        }

        hedge.setOpenLots(hedge.getOpenLots() - req.getLots());
        if (hedge.getOpenLots() <= 0) {
            hedge.setStatus(HedgeTradeStatus.CLOSED);
        }
        hedgeRepo.save(hedge);

        return toResponse(offsetRepo.save(offset));
    }

    @Transactional(readOnly = true)
    public List<HedgeOffsetResponse> getByBook(String book) {
        return offsetRepo.findByHedgeTrade_BookOrderByOffsetDateDesc(book)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private HedgeOffsetResponse toResponse(HedgeOffset o) {
        HedgeTrade h = o.getHedgeTrade();
        BigDecimal entryPrice = h.getPricePerBushel();
        BigDecimal pnlCents = o.getExitPrice().subtract(entryPrice);
        BigDecimal pnlUsd = pnlCents
                .multiply(BUSHELS_PER_LOT)
                .multiply(BigDecimal.valueOf(o.getLots()))
                .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);

        return HedgeOffsetResponse.builder()
                .id(o.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .siteCode(o.getSite() != null ? o.getSite().getCode() : null)
                .siteName(o.getSite() != null ? o.getSite().getName() : null)
                .lots(o.getLots())
                .entryPrice(entryPrice)
                .exitPrice(o.getExitPrice())
                .pnlCentsBu(pnlCents)
                .pnlUsd(pnlUsd)
                .offsetDate(o.getOffsetDate())
                .notes(o.getNotes())
                .build();
    }
}
