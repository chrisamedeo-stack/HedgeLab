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

    private final HedgeTradeRepository         hedgeRepo;
    private final PhysicalContractRepository   contractRepo;
    private final EFPTicketRepository          efpRepo;
    private final CornDailySettleRepository    settleRepo;
    private final ZcMonthMapper                zcMonthMapper;

    @Transactional(readOnly = true)
    public CornPositionResponse getPositions() {

        // ---- 1. Corporate Pool: OPEN + PARTIALLY_ALLOCATED hedges --------
        List<HedgeTrade> openHedges = hedgeRepo.findByStatusInOrderByTradeDateDesc(
                List.of(HedgeTradeStatus.OPEN, HedgeTradeStatus.PARTIALLY_ALLOCATED));

        // Collect latest settle for each unique futures month
        Map<String, BigDecimal> settles = new LinkedHashMap<>();
        for (HedgeTrade h : openHedges) {
            settles.computeIfAbsent(h.getFuturesMonth(), fm ->
                    settleRepo.findTopByFuturesMonthOrderBySettleDateDesc(fm)
                              .map(CornDailySettle::getPricePerBushel)
                              .orElse(null));
        }

        List<CorporatePoolItem> pool = openHedges.stream()
                .map(h -> buildPoolItem(h, settles))
                .collect(Collectors.toList());

        // ---- 2. Physical positions: all non-terminal contracts ------------
        List<PhysicalContract> contracts = contractRepo.findByStatusNotIn(
                List.of(PhysicalContractStatus.CLOSED, PhysicalContractStatus.CANCELLED));
        contracts.sort(Comparator.comparing(PhysicalContract::getDeliveryMonth)
                                 .thenComparing(c -> c.getSite().getCode()));

        List<PhysicalPositionItem> physical = contracts.stream()
                .map(this::buildPhysicalItem)
                .collect(Collectors.toList());

        // ---- 3. Locked positions: all EFPs --------------------------------
        List<EFPTicket> efps = efpRepo.findAllByOrderByEfpDateDesc();
        List<LockedPositionItem> locked = efps.stream()
                .map(this::buildLockedItem)
                .collect(Collectors.toList());

        // Remove nulls from settles map (futures months with no published settle)
        settles.entrySet().removeIf(e -> e.getValue() == null);

        return CornPositionResponse.builder()
                .corporatePool(pool)
                .physicalPositions(physical)
                .lockedPositions(locked)
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

    private CorporatePoolItem buildPoolItem(HedgeTrade h, Map<String, BigDecimal> settles) {
        BigDecimal settle = settles.get(h.getFuturesMonth());
        BigDecimal mtmPnl = null;
        if (settle != null && h.getOpenLots() != null && h.getOpenLots() > 0) {
            BigDecimal priceDiff = settle.subtract(h.getPricePerBushel());
            BigDecimal bushels   = BUSHELS_PER_LOT.multiply(BigDecimal.valueOf(h.getOpenLots()));
            mtmPnl = priceDiff.multiply(bushels)
                               .divide(CENTS_PER_DOLLAR, 2, RoundingMode.HALF_UP);
        }
        BigDecimal openMt = null;
        if (h.getOpenLots() != null) {
            openMt = BUSHELS_PER_LOT.multiply(BigDecimal.valueOf(h.getOpenLots()))
                                     .divide(BUSHELS_PER_MT, 2, RoundingMode.HALF_UP);
        }
        return CorporatePoolItem.builder()
                .hedgeTradeId(h.getId())
                .tradeRef(h.getTradeRef())
                .futuresMonth(h.getFuturesMonth())
                .lots(h.getLots())
                .openLots(h.getOpenLots())
                .entryPrice(h.getPricePerBushel())
                .settlePrice(settle)
                .mtmPnlUsd(mtmPnl)
                .openMt(openMt)
                .validDeliveryMonths(zcMonthMapper.getValidDeliveryMonths(h.getFuturesMonth()))
                .status(h.getStatus().name())
                .brokerAccount(h.getBrokerAccount())
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
                .build();
    }

    private LockedPositionItem buildLockedItem(EFPTicket e) {
        PhysicalContract c = e.getPhysicalContract();
        BigDecimal allIn = calcAllIn(e.getBoardPrice(), c.getBasisCentsBu(), c.getFreightPerMt());
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
