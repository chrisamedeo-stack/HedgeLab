package com.hedgelab.api.service;

import com.hedgelab.api.dto.CommoditySpec;
import com.hedgelab.api.dto.request.PublishSettleRequest;
import com.hedgelab.api.dto.response.CornPositionResponse;
import com.hedgelab.api.dto.response.CornPositionResponse.*;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import com.hedgelab.api.util.FuturesMonthMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class CornPositionService {

    private final HedgeTradeRepository         hedgeRepo;
    private final PhysicalContractRepository   contractRepo;
    private final EFPTicketRepository          efpRepo;
    private final CornDailySettleRepository    settleRepo;
    private final HedgeAllocationRepository    allocationRepo;
    private final HedgeOffsetRepository        offsetRepo;
    private final FuturesMonthMapper           futuresMonthMapper;
    private final CommodityPriceApiClient      priceApiClient;
    private final CommoditySpecService         specService;

    @Transactional(readOnly = true)
    public CornPositionResponse getPositions(String commodityCode, String book) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        String prefix = spec.futuresPrefix();
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bushelsPerLot = BigDecimal.valueOf(spec.contractSizeBu());
        int bushelsPerLotInt = spec.contractSizeBu();

        // Map book to country for physical/locked filtering
        String country = null;
        if (book != null && !book.isBlank()) {
            country = "US".equalsIgnoreCase(book) ? "US" : "Canada";
        }

        // ---- Collect settles for all relevant futures months ----------------
        Map<String, BigDecimal> settles = new LinkedHashMap<>();

        // ---- 1. Hedge Book: OPEN + PARTIALLY_ALLOCATED hedges ---------------
        List<HedgeTradeStatus> poolStatuses = List.of(
                HedgeTradeStatus.OPEN, HedgeTradeStatus.PARTIALLY_ALLOCATED,
                HedgeTradeStatus.FULLY_ALLOCATED);
        List<HedgeTrade> openHedges;
        if (book != null && !book.isBlank()) {
            openHedges = hedgeRepo.findByStatusInAndBookOrderByTradeDateDesc(
                    poolStatuses, book.toUpperCase());
        } else {
            openHedges = hedgeRepo.findByStatusInOrderByTradeDateDesc(poolStatuses);
        }

        // Filter by commodity prefix
        openHedges = openHedges.stream()
                .filter(h -> h.getFuturesMonth() != null && h.getFuturesMonth().startsWith(prefix))
                .collect(Collectors.toList());

        // Populate settles
        for (HedgeTrade h : openHedges) {
            settles.computeIfAbsent(h.getFuturesMonth(), fm ->
                    settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                              .map(CornDailySettle::getPricePerBushel)
                              .orElse(null));
        }

        List<HedgeBookItem> hedgeBook = openHedges.stream()
                .map(h -> buildHedgeBookItem(h, settles, bushelsPerMt, bushelsPerLot, bushelsPerLotInt))
                .collect(Collectors.toList());

        // ---- 2. Site Allocations: all allocations ---------------------------
        List<HedgeAllocation> allAllocations;
        if (book != null && !book.isBlank()) {
            final String bookUpper = book.toUpperCase();
            allAllocations = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() != null)
                    .filter(a -> bookUpper.equalsIgnoreCase(a.getHedgeTrade().getBook()))
                    .filter(a -> a.getHedgeTrade().getFuturesMonth() != null
                            && a.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                    .collect(Collectors.toList());
        } else {
            allAllocations = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() != null)
                    .filter(a -> a.getHedgeTrade().getFuturesMonth() != null
                            && a.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                    .collect(Collectors.toList());
        }

        List<SiteAllocationItem> siteAllocations = allAllocations.stream()
                .map(a -> buildSiteAllocationItem(a, settles, bushelsPerMt, bushelsPerLot, bushelsPerLotInt))
                .collect(Collectors.toList());

        // ---- 2b. Month-only Allocations: site IS NULL ----------------------------
        List<HedgeAllocation> monthOnlyAllocs;
        if (book != null && !book.isBlank()) {
            final String bookUpper = book.toUpperCase();
            monthOnlyAllocs = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() == null)
                    .filter(a -> bookUpper.equalsIgnoreCase(a.getHedgeTrade().getBook()))
                    .filter(a -> a.getHedgeTrade().getFuturesMonth() != null
                            && a.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                    .collect(Collectors.toList());
        } else {
            monthOnlyAllocs = allocationRepo.findAll().stream()
                    .filter(a -> a.getSite() == null)
                    .filter(a -> a.getHedgeTrade().getFuturesMonth() != null
                            && a.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                    .collect(Collectors.toList());
        }

        List<MonthAllocationItem> monthAllocations = monthOnlyAllocs.stream()
                .map(a -> buildMonthAllocationItem(a, bushelsPerMt, bushelsPerLot, bushelsPerLotInt))
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

        // Filter by commodity
        contracts = contracts.stream()
                .filter(c -> c.getCommodityCode() != null && c.getCommodityCode().startsWith(spec.code()))
                .collect(Collectors.toList());

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
                .map(c -> buildPhysicalItem(c, bushelsPerMt))
                .collect(Collectors.toList());

        // ---- 4. Locked positions: all EFPs with gain/loss -------------------
        List<EFPTicket> efps = efpRepo.findAllByOrderByEfpDateDesc().stream()
                .filter(e -> e.getFuturesMonth() != null && e.getFuturesMonth().startsWith(prefix))
                .collect(Collectors.toList());
        List<LockedPositionItem> locked;
        if (country != null) {
            final String filterCountry = country;
            locked = efps.stream()
                    .filter(e -> filterCountry.equalsIgnoreCase(
                            e.getPhysicalContract().getSite().getCountry()))
                    .map(e -> buildLockedItem(e, bushelsPerMt, bushelsPerLot))
                    .collect(Collectors.toList());
        } else {
            locked = efps.stream()
                    .map(e -> buildLockedItem(e, bushelsPerMt, bushelsPerLot))
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

        // Filter by commodity prefix
        offsetEntities = offsetEntities.stream()
                .filter(o -> o.getHedgeTrade().getFuturesMonth() != null
                        && o.getHedgeTrade().getFuturesMonth().startsWith(prefix))
                .collect(Collectors.toList());

        List<OffsetItem> offsets = offsetEntities.stream()
                .map(o -> buildOffsetItem(o, bushelsPerLot, bushelsPerLotInt))
                .collect(Collectors.toList());

        // Remove nulls from settles map
        settles.entrySet().removeIf(e -> e.getValue() == null);

        return CornPositionResponse.builder()
                .hedgeBook(hedgeBook)
                .siteAllocations(siteAllocations)
                .monthAllocations(monthAllocations)
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

    @Transactional
    public Map<String, Object> refreshPrices(String commodityCode) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        String prefix = spec.futuresPrefix();

        // Collect all active futures months from open hedges
        List<HedgeTradeStatus> poolStatuses = List.of(
                HedgeTradeStatus.OPEN, HedgeTradeStatus.PARTIALLY_ALLOCATED,
                HedgeTradeStatus.FULLY_ALLOCATED);
        List<HedgeTrade> openHedges = hedgeRepo.findByStatusInOrderByTradeDateDesc(poolStatuses);
        Set<String> futuresMonths = openHedges.stream()
                .filter(h -> h.getFuturesMonth() != null && h.getFuturesMonth().startsWith(prefix))
                .map(HedgeTrade::getFuturesMonth)
                .collect(Collectors.toSet());

        if (futuresMonths.isEmpty()) {
            return Map.of("status", "skipped", "reason", "No active futures months");
        }

        // Fetch the latest price from the external API
        Map<String, BigDecimal> prices = priceApiClient.fetchLatestPrices(List.of(spec.code()));
        BigDecimal price = prices.get(spec.code());
        if (price == null) {
            log.warn("[RefreshPrices] No {} price returned from API", spec.code());
            return Map.of("status", "error", "reason", "No " + spec.code() + " price returned from API");
        }

        // Save as settle for each active futures month
        LocalDate today = LocalDate.now();
        for (String fm : futuresMonths) {
            CornDailySettle ds = CornDailySettle.builder()
                    .futuresMonth(fm)
                    .settleDate(today)
                    .pricePerBushel(price)
                    .build();
            settleRepo.save(ds);
        }

        log.info("[RefreshPrices] Published {} settle {} for {} months", spec.code(), price, futuresMonths.size());
        return Map.of(
                "status", "ok",
                "price", price,
                "months", futuresMonths.size(),
                "date", today.toString()
        );
    }

    // -------------------------------------------------------------------------
    // Private builders
    // -------------------------------------------------------------------------

    private HedgeBookItem buildHedgeBookItem(HedgeTrade h, Map<String, BigDecimal> settles,
                                              BigDecimal bushelsPerMt, BigDecimal bushelsPerLot, int bushelsPerLotInt) {
        int allocatedLots = allocationRepo.sumAllocatedLotsByTradeId(h.getId());
        int unallocatedLots = Math.max(0, h.getOpenLots() - allocatedLots);
        int unallocatedBushels = unallocatedLots * bushelsPerLotInt;
        int allocatedBushels = allocatedLots * bushelsPerLotInt;

        BigDecimal settle = settles.get(h.getFuturesMonth());
        BigDecimal mtmPnl = null;
        if (settle != null && unallocatedLots > 0) {
            BigDecimal priceDiff = settle.subtract(h.getPricePerBushel());
            mtmPnl = priceDiff
                    .multiply(BigDecimal.valueOf(unallocatedLots))
                    .multiply(bushelsPerLot)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        BigDecimal unallocMt = bushelsPerLot
                .multiply(BigDecimal.valueOf(unallocatedLots))
                .divide(bushelsPerMt, 2, RoundingMode.HALF_UP);

        return HedgeBookItem.builder()
                .hedgeTradeId(h.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .lots(h.getLots())
                .bushels(h.getLots() * bushelsPerLotInt)
                .openLots(h.getOpenLots())
                .allocatedLots(allocatedLots)
                .allocatedBushels(allocatedBushels)
                .unallocatedLots(unallocatedLots)
                .unallocatedBushels(unallocatedBushels)
                .entryPrice(h.getPricePerBushel())
                .settlePrice(settle)
                .mtmPnlUsd(mtmPnl)
                .unallocatedMt(unallocMt)
                .validDeliveryMonths(futuresMonthMapper.getValidDeliveryMonths(h.getFuturesMonth()))
                .status(h.getStatus().name())
                .brokerAccount(h.getBrokerAccount())
                .side(h.getSide())
                .build();
    }

    private SiteAllocationItem buildSiteAllocationItem(HedgeAllocation a,
                                                        Map<String, BigDecimal> settles,
                                                        BigDecimal bushelsPerMt, BigDecimal bushelsPerLot, int bushelsPerLotInt) {
        HedgeTrade h = a.getHedgeTrade();
        // Ensure settle is populated for this futures month
        settles.computeIfAbsent(h.getFuturesMonth(), fm ->
                settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                          .map(CornDailySettle::getPricePerBushel)
                          .orElse(null));

        BigDecimal settle = settles.get(h.getFuturesMonth());
        int allocBushels = a.getAllocatedLots() * bushelsPerLotInt;
        BigDecimal allocMt = bushelsPerLot
                .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                .divide(bushelsPerMt, 2, RoundingMode.HALF_UP);

        BigDecimal mtmPnl = null;
        if (settle != null && a.getAllocatedLots() > 0) {
            BigDecimal priceDiff = settle.subtract(h.getPricePerBushel());
            mtmPnl = priceDiff
                    .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                    .multiply(bushelsPerLot)
                    .setScale(2, RoundingMode.HALF_UP);
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
                .side(h.getSide())
                .tradeDate(h.getTradeDate())
                .build();
    }

    private MonthAllocationItem buildMonthAllocationItem(HedgeAllocation a,
                                                          BigDecimal bushelsPerMt, BigDecimal bushelsPerLot, int bushelsPerLotInt) {
        HedgeTrade h = a.getHedgeTrade();
        int allocBushels = a.getAllocatedLots() * bushelsPerLotInt;
        BigDecimal allocMt = bushelsPerLot
                .multiply(BigDecimal.valueOf(a.getAllocatedLots()))
                .divide(bushelsPerMt, 2, RoundingMode.HALF_UP);
        return MonthAllocationItem.builder()
                .allocationId(a.getId())
                .hedgeTradeId(h.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .budgetMonth(a.getBudgetMonth())
                .allocatedLots(a.getAllocatedLots())
                .allocatedBushels(allocBushels)
                .allocatedMt(allocMt)
                .entryPrice(h.getPricePerBushel())
                .side(h.getSide())
                .tradeDate(h.getTradeDate())
                .build();
    }

    private PhysicalPositionItem buildPhysicalItem(PhysicalContract c, BigDecimal bushelsPerMt) {
        boolean basisLocked  = c.getBasisLockedDate() != null;
        boolean efpExecuted  = c.getBoardPricePerBu() != null;
        BigDecimal allIn     = calcAllIn(c.getBoardPricePerBu(), c.getBasisPerBu(), c.getFreightPerMt(), bushelsPerMt);
        return PhysicalPositionItem.builder()
                .contractId(c.getId())
                .contractRef(c.getContractRef())
                .deliveryMonth(c.getDeliveryMonth())
                .siteCode(c.getSite().getCode())
                .siteName(c.getSite().getName())
                .supplierName(c.getSupplierName())
                .committedMt(c.getQuantityMt())
                .basisValue(c.getBasisPerBu())
                .basisLocked(basisLocked)
                .boardPriceLocked(c.getBoardPricePerBu())
                .efpExecuted(efpExecuted)
                .allInPricePerMt(allIn)
                .status(c.getStatus().name())
                .tradeType(c.getTradeType() != null ? c.getTradeType().name() : "BASIS")
                .futuresRef(c.getFuturesRef())
                .build();
    }

    private LockedPositionItem buildLockedItem(EFPTicket e, BigDecimal bushelsPerMt, BigDecimal bushelsPerLot) {
        PhysicalContract c = e.getPhysicalContract();
        BigDecimal allIn = calcAllIn(e.getBoardPrice(), c.getBasisPerBu(), c.getFreightPerMt(), bushelsPerMt);

        // Gain/loss: entryPrice = snapshot from EFP (fallback to hedge for pre-migration)
        BigDecimal entryPrice = e.getEntryPrice() != null
                ? e.getEntryPrice()
                : e.getHedgeTrade().getPricePerBushel();
        BigDecimal futuresBuy = entryPrice;
        BigDecimal futuresSell = e.getBoardPrice();

        BigDecimal gainLossPerBu = null;
        BigDecimal gainLossUsd = null;
        BigDecimal gainLossPerMt = null;
        BigDecimal effectiveAllIn = null;

        if (futuresBuy != null && futuresSell != null) {
            gainLossPerBu = futuresSell.subtract(futuresBuy);
            gainLossUsd = gainLossPerBu
                    .multiply(BigDecimal.valueOf(e.getLots()))
                    .multiply(bushelsPerLot)
                    .setScale(2, RoundingMode.HALF_UP);
            gainLossPerMt = gainLossPerBu
                    .multiply(bushelsPerMt)
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
                .basisValue(c.getBasisPerBu())
                .freightValue(c.getFreightPerMt())
                .allInPricePerMt(allIn)
                .quantityMt(e.getQuantityMt())
                .efpDate(e.getEfpDate())
                .confirmationRef(e.getConfirmationRef())
                .status(e.getStatus().name())
                .entryPrice(entryPrice)
                .futuresBuyPrice(futuresBuy)
                .futuresSellPrice(futuresSell)
                .gainLossPerBu(gainLossPerBu)
                .gainLossUsd(gainLossUsd)
                .gainLossPerMt(gainLossPerMt)
                .effectiveAllInPerMt(effectiveAllIn)
                .build();
    }

    private OffsetItem buildOffsetItem(HedgeOffset o, BigDecimal bushelsPerLot, int bushelsPerLotInt) {
        HedgeTrade h = o.getHedgeTrade();
        BigDecimal entryPrice = h.getPricePerBushel();
        BigDecimal pnlPerBu = o.getExitPrice().subtract(entryPrice);
        BigDecimal pnlUsd = pnlPerBu
                .multiply(BigDecimal.valueOf(o.getLots()))
                .multiply(bushelsPerLot)
                .setScale(2, RoundingMode.HALF_UP);

        return OffsetItem.builder()
                .offsetId(o.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .siteCode(o.getSite() != null ? o.getSite().getCode() : null)
                .siteName(o.getSite() != null ? o.getSite().getName() : null)
                .lots(o.getLots())
                .bushels(o.getLots() * bushelsPerLotInt)
                .entryPrice(entryPrice)
                .exitPrice(o.getExitPrice())
                .pnlPerBu(pnlPerBu)
                .pnlUsd(pnlUsd)
                .offsetDate(o.getOffsetDate())
                .notes(o.getNotes())
                .build();
    }

    /**
     * all-in $/MT = (board $/bu + basis $/bu) × bushelsPerMt + freight $/MT
     * Returns null if any required component is missing.
     */
    private BigDecimal calcAllIn(BigDecimal boardPerBu, BigDecimal basisPerBu, BigDecimal freightPerMt,
                                  BigDecimal bushelsPerMt) {
        if (boardPerBu == null || basisPerBu == null || freightPerMt == null) return null;
        return boardPerBu.add(basisPerBu)
                         .multiply(bushelsPerMt)
                         .add(freightPerMt)
                         .setScale(2, RoundingMode.HALF_UP);
    }
}
