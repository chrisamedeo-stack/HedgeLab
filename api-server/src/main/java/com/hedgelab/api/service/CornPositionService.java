package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.PublishSettleRequest;
import com.hedgelab.api.dto.response.CornPositionResponse;
import com.hedgelab.api.dto.response.CornPositionResponse.*;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import com.hedgelab.api.util.ZcMonthMapper;
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
public class CornPositionService {

    private static final BigDecimal BUSHELS_PER_MT  = new BigDecimal("39.3683");
    private static final BigDecimal BUSHELS_PER_LOT = new BigDecimal("5000");
    private static final BigDecimal CENTS_PER_DOLLAR = new BigDecimal("100");
    private static final int BUSHELS_PER_LOT_INT = 5000;

    private final HedgeTradeRepository         hedgeRepo;
    private final PhysicalContractRepository   contractRepo;
    private final EFPTicketRepository          efpRepo;
    private final CornDailySettleRepository    settleRepo;
    private final HedgeAllocationRepository    allocationRepo;
    private final HedgeOffsetRepository        offsetRepo;
    private final ZcMonthMapper                zcMonthMapper;

    @Transactional(readOnly = true)
    public CornPositionResponse getPositions(String book) {

        // Map book to country for physical/locked filtering
        String country = null;
        if (book != null && !book.isBlank()) {
            country = "US".equalsIgnoreCase(book) ? "US" : "Canada";
        }

        // ---- Collect settles for all relevant futures months ----------------
        Map<String, BigDecimal> settles = new LinkedHashMap<>();

        // ---- 1. Hedge Book: OPEN + PARTIALLY_ALLOCATED hedges ---------------
        List<HedgeTradeStatus> poolStatuses = List.of(
                HedgeTradeStatus.OPEN, HedgeTradeStatus.PARTIALLY_ALLOCATED);
        List<HedgeTrade> openHedges;
        if (book != null && !book.isBlank()) {
            openHedges = hedgeRepo.findByStatusInAndBookOrderByTradeDateDesc(
                    poolStatuses, book.toUpperCase());
        } else {
            openHedges = hedgeRepo.findByStatusInOrderByTradeDateDesc(poolStatuses);
        }

        // Populate settles
        for (HedgeTrade h : openHedges) {
            settles.computeIfAbsent(h.getFuturesMonth(), fm ->
                    settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                              .map(CornDailySettle::getPricePerBushel)
                              .orElse(null));
        }

        List<HedgeBookItem> hedgeBook = openHedges.stream()
                .map(h -> buildHedgeBookItem(h, settles))
                .filter(item -> item.getUnallocatedLots() > 0)
                .collect(Collectors.toList());

        // ---- 2. Site Allocations: all allocations ---------------------------
        List<HedgeAllocation> allAllocations;
        if (book != null && !book.isBlank()) {
            final String bookUpper = book.toUpperCase();
            allAllocations = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() != null) // exclude month-only allocations
                    .filter(a -> bookUpper.equalsIgnoreCase(a.getHedgeTrade().getBook()))
                    .collect(Collectors.toList());
        } else {
            allAllocations = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() != null) // exclude month-only allocations
                    .collect(Collectors.toList());
        }

        List<SiteAllocationItem> siteAllocations = allAllocations.stream()
                .map(a -> buildSiteAllocationItem(a, settles))
                .collect(Collectors.toList());

        // ---- 3. Physical positions: all non-terminal contracts --------------
        List<PhysicalContractStatus> terminalStatuses = List.of(
                PhysicalContractStatus.CLOSED, PhysicalContractStatus.CANCELLED);
        List<PhysicalContract> contracts;
        if (country != null) {
            contracts = contractRepo.findByStatusNotInAndSite_CountryOrderByDeliveryMonth(
                    terminalStatuses, country);
        } else {
            contracts = contractRepo.findByStatusNotIn(terminalStatuses);
            contracts.sort(Comparator.comparing(PhysicalContract::getDeliveryMonth)
                                     .thenComparing(c -> c.getSite().getCode()));
        }

        // Ensure settles are populated for physical contract futures months
        for (PhysicalContract c : contracts) {
            if (c.getFuturesRef() != null) {
                settles.computeIfAbsent(c.getFuturesRef(), fm ->
                        settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                                  .map(CornDailySettle::getPricePerBushel)
                                  .orElse(null));
            }
        }

        List<PhysicalPositionItem> physical = contracts.stream()
                .map(this::buildPhysicalItem)
                .collect(Collectors.toList());

        // ---- 4. Locked positions: all EFPs with gain/loss -------------------
        List<EFPTicket> efps = efpRepo.findAllByOrderByEfpDateDesc();
        List<LockedPositionItem> locked;
        if (country != null) {
            final String filterCountry = country;
            locked = efps.stream()
                    .filter(e -> filterCountry.equalsIgnoreCase(
                            e.getPhysicalContract().getSite().getCountry()))
                    .map(this::buildLockedItem)
                    .collect(Collectors.toList());
        } else {
            locked = efps.stream()
                    .map(this::buildLockedItem)
                    .collect(Collectors.toList());
        }

        // ---- 5. Offsets -----------------------------------------------------
        List<HedgeOffset> offsetEntities;
        if (book != null && !book.isBlank()) {
            offsetEntities = offsetRepo.findByHedgeTrade_BookOrderByOffsetDateDesc(
                    book.toUpperCase());
        } else {
            offsetEntities = offsetRepo.findAll();
        }

        List<OffsetItem> offsets = offsetEntities.stream()
                .map(this::buildOffsetItem)
                .collect(Collectors.toList());

        // Remove nulls from settles map
        settles.entrySet().removeIf(e -> e.getValue() == null);

        return CornPositionResponse.builder()
                .hedgeBook(hedgeBook)
                .siteAllocations(siteAllocations)
                .physicalPositions(physical)
                .lockedPositions(locked)
                .offsets(offsets)
                .latestSettles(settles)
                .build();
    }

    @Transactional
    public void publishSettle(PublishSettleRequest req) {
        LocalDate date = req.getSettleDate() != null ? req.getSettleDate() : LocalDate.now();
        if (req.getPrices() == null || req.getPrices().isEmpty()) return;
        req.getPrices().forEach((fm, price) -> {
            CornDailySettle ds = CornDailySettle.builder()
                    .futuresMonth(fm.toUpperCase())
                    .settleDate(date)
                    .pricePerBushel(price)
                    .build();
            settleRepo.save(ds);
        });
    }

    // -------------------------------------------------------------------------
    // Private builders
    // -------------------------------------------------------------------------

    private HedgeBookItem buildHedgeBookItem(HedgeTrade h, Map<String, BigDecimal> settles) {
        int allocatedLots = allocationRepo.sumAllocatedLotsByTradeId(h.getId());
        int unallocatedLots = Math.max(0, h.getOpenLots() - allocatedLots);
        int unallocatedBushels = unallocatedLots * BUSHELS_PER_LOT_INT;
        int allocatedBushels = allocatedLots * BUSHELS_PER_LOT_INT;

        BigDecimal settle = settles.get(h.getFuturesMonth());
        BigDecimal mtmPnl = null;
        if (settle != null && unallocatedLots > 0) {
            BigDecimal priceDiff = settle.subtract(h.getPricePerBushel());
            mtmPnl = priceDiff
                    .multiply(BigDecimal.valueOf(unallocatedLots))
                    .multiply(BUSHELS_PER_LOT)
                    .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);
        }

        BigDecimal unallocMt = BUSHELS_PER_LOT
                .multiply(BigDecimal.valueOf(unallocatedLots))
                .divide(BUSHELS_PER_MT, 2, RoundingMode.HALF_UP);

        return HedgeBookItem.builder()
                .hedgeTradeId(h.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .lots(h.getLots())
                .bushels(h.getLots() * BUSHELS_PER_LOT_INT)
                .openLots(h.getOpenLots())
                .allocatedLots(allocatedLots)
                .allocatedBushels(allocatedBushels)
                .unallocatedLots(unallocatedLots)
                .unallocatedBushels(unallocatedBushels)
                .entryPrice(h.getPricePerBushel())
                .settlePrice(settle)
                .mtmPnlUsd(mtmPnl)
                .unallocatedMt(unallocMt)
                .validDeliveryMonths(zcMonthMapper.getValidDeliveryMonths(h.getFuturesMonth()))
                .status(h.getStatus().name())
                .brokerAccount(h.getBrokerAccount())
                .build();
    }

    private SiteAllocationItem buildSiteAllocationItem(HedgeAllocation a,
                                                        Map<String, BigDecimal> settles) {
        HedgeTrade h = a.getHedgeTrade();
        // Ensure settle is populated for this futures month
        settles.computeIfAbsent(h.getFuturesMonth(), fm ->
                settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                          .map(CornDailySettle::getPricePerBushel)
                          .orElse(null));

        BigDecimal settle = settles.get(h.getFuturesMonth());
        int allocBushels = a.getAllocatedLots() * BUSHELS_PER_LOT_INT;
        BigDecimal allocMt = BUSHELS_PER_LOT
                .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                .divide(BUSHELS_PER_MT, 2, RoundingMode.HALF_UP);

        BigDecimal mtmPnl = null;
        if (settle != null && a.getAllocatedLots() > 0) {
            BigDecimal priceDiff = settle.subtract(h.getPricePerBushel());
            mtmPnl = priceDiff
                    .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                    .multiply(BUSHELS_PER_LOT)
                    .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);
        }

        // Count EFP'd lots for this hedge+site combination
        int efpdLots = efpRepo.findByHedgeTradeIdOrderByEfpDateDesc(h.getId()).stream()
                .filter(e -> a.getSite().getCode().equals(e.getPhysicalContract().getSite().getCode()))
                .mapToInt(EFPTicket::getLots)
                .sum();

        // Count offset lots for this allocation
        int offsetLots = offsetRepo.sumOffsetLotsByAllocationId(a.getId());

        int openAllocated = Math.max(0, a.getAllocatedLots() - efpdLots - offsetLots);

        return SiteAllocationItem.builder()
                .allocationId(a.getId())
                .hedgeTradeId(h.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .siteCode(a.getSite().getCode())
                .siteName(a.getSite().getName())
                .budgetMonth(a.getBudgetMonth())
                .allocatedLots(a.getAllocatedLots())
                .allocatedBushels(allocBushels)
                .allocatedMt(allocMt)
                .entryPrice(h.getPricePerBushel())
                .settlePrice(settle)
                .mtmPnlUsd(mtmPnl)
                .efpdLots(efpdLots)
                .offsetLots(offsetLots)
                .openAllocatedLots(openAllocated)
                .build();
    }

    private PhysicalPositionItem buildPhysicalItem(PhysicalContract c) {
        boolean basisLocked  = c.getBasisLockedDate() != null;
        boolean efpExecuted  = c.getBoardPriceCentsBu() != null;
        BigDecimal allIn     = calcAllIn(c.getBoardPriceCentsBu(), c.getBasisCentsBu(), c.getFreightPerMt());
        return PhysicalPositionItem.builder()
                .contractId(c.getId())
                .contractRef(c.getContractRef())
                .deliveryMonth(c.getDeliveryMonth())
                .siteCode(c.getSite().getCode())
                .siteName(c.getSite().getName())
                .supplierName(c.getSupplierName())
                .committedMt(c.getQuantityMt())
                .basisValue(c.getBasisCentsBu())
                .basisLocked(basisLocked)
                .boardPriceLocked(c.getBoardPriceCentsBu())
                .efpExecuted(efpExecuted)
                .allInPricePerMt(allIn)
                .status(c.getStatus().name())
                .tradeType(c.getTradeType() != null ? c.getTradeType().name() : "BASIS")
                .futuresRef(c.getFuturesRef())
                .build();
    }

    private LockedPositionItem buildLockedItem(EFPTicket e) {
        PhysicalContract c = e.getPhysicalContract();
        BigDecimal allIn = calcAllIn(e.getBoardPrice(), c.getBasisCentsBu(), c.getFreightPerMt());

        // Gain/loss: entryPrice = snapshot from EFP (fallback to hedge for pre-migration)
        BigDecimal entryPrice = e.getEntryPrice() != null
                ? e.getEntryPrice()
                : e.getHedgeTrade().getPricePerBushel();
        BigDecimal futuresBuy = entryPrice;
        BigDecimal futuresSell = e.getBoardPrice();

        BigDecimal gainLossCentsBu = null;
        BigDecimal gainLossUsd = null;
        BigDecimal gainLossPerMt = null;
        BigDecimal effectiveAllIn = null;

        if (futuresBuy != null && futuresSell != null) {
            gainLossCentsBu = futuresSell.subtract(futuresBuy);
            gainLossUsd = gainLossCentsBu
                    .multiply(BigDecimal.valueOf(e.getLots()))
                    .multiply(BUSHELS_PER_LOT)
                    .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);
            gainLossPerMt = gainLossCentsBu
                    .divide(CENTS_PER_DOLLAR, 10, RoundingMode.HALF_UP)
                    .multiply(BUSHELS_PER_MT)
                    .setScale(2, RoundingMode.HALF_UP);
            if (allIn != null) {
                effectiveAllIn = allIn.subtract(gainLossPerMt);
            }
        }

        return LockedPositionItem.builder()
                .efpTicketId(e.getId())
                .ticketRef(e.getTicketRef())
                .siteCode(c.getSite().getCode())
                .siteName(c.getSite().getName())
                .supplierName(c.getSupplierName())
                .deliveryMonth(c.getDeliveryMonth())
                .futuresMonth(e.getFuturesMonth())
                .lots(e.getLots())
                .boardPrice(e.getBoardPrice())
                .basisValue(c.getBasisCentsBu())
                .freightValue(c.getFreightPerMt())
                .allInPricePerMt(allIn)
                .quantityMt(e.getQuantityMt())
                .efpDate(e.getEfpDate())
                .confirmationRef(e.getConfirmationRef())
                .status(e.getStatus().name())
                .entryPrice(entryPrice)
                .futuresBuyPrice(futuresBuy)
                .futuresSellPrice(futuresSell)
                .gainLossCentsBu(gainLossCentsBu)
                .gainLossUsd(gainLossUsd)
                .gainLossPerMt(gainLossPerMt)
                .effectiveAllInPerMt(effectiveAllIn)
                .build();
    }

    private OffsetItem buildOffsetItem(HedgeOffset o) {
        HedgeTrade h = o.getHedgeTrade();
        BigDecimal entryPrice = h.getPricePerBushel();
        BigDecimal pnlCents = o.getExitPrice().subtract(entryPrice);
        BigDecimal pnlUsd = pnlCents
                .multiply(BigDecimal.valueOf(o.getLots()))
                .multiply(BUSHELS_PER_LOT)
                .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);

        return OffsetItem.builder()
                .offsetId(o.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .siteCode(o.getSite() != null ? o.getSite().getCode() : null)
                .siteName(o.getSite() != null ? o.getSite().getName() : null)
                .lots(o.getLots())
                .bushels(o.getLots() * BUSHELS_PER_LOT_INT)
                .entryPrice(entryPrice)
                .exitPrice(o.getExitPrice())
                .pnlCentsBu(pnlCents)
                .pnlUsd(pnlUsd)
                .offsetDate(o.getOffsetDate())
                .notes(o.getNotes())
                .build();
    }

    /**
     * all-in $/MT = (board ¢/bu + basis ¢/bu) / 100 × 39.3683 bu/MT + freight $/MT
     * Returns null if any required component is missing.
     */
    private BigDecimal calcAllIn(BigDecimal boardCents, BigDecimal basisCents, BigDecimal freightPerMt) {
        if (boardCents == null || basisCents == null || freightPerMt == null) return null;
        return boardCents.add(basisCents)
                         .divide(CENTS_PER_DOLLAR, 10, RoundingMode.HALF_UP)
                         .multiply(BUSHELS_PER_MT)
                         .add(freightPerMt)
                         .setScale(2, RoundingMode.HALF_UP);
    }
}
