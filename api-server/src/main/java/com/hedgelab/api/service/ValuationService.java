package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.MtmValuationResponse;
import com.hedgelab.api.dto.response.PnlResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ValuationService {

    private final TradeRepository tradeRepo;
    private final MtmValuationRepository mtmRepo;
    private final PnlSnapshotRepository pnlRepo;
    private final BookRepository bookRepo;
    private final PricingEngineService pricingEngine;

    @Transactional
    public int runEodValuation(LocalDate valuationDate) {
        List<Trade> openTrades = tradeRepo.findAllOpenAsOf(valuationDate);
        int count = 0;
        for (Trade trade : openTrades) {
            try {
                valuateTrade(trade, valuationDate);
                count++;
            } catch (Exception e) {
                log.warn("Could not valuate trade {}: {}", trade.getTradeReference(), e.getMessage());
            }
        }
        log.info("EOD valuation complete for {}. Valuated {} trades.", valuationDate, count);
        return count;
    }

    @Transactional
    public MtmValuationResponse valuateTrade(Trade trade, LocalDate valuationDate) {
        // Resolve the market price for the first open delivery month
        YearMonth deliveryMonth = trade.getDeliverySchedules().stream()
            .filter(ds -> ds.getStatus() == DeliveryStatus.PENDING || ds.getStatus() == DeliveryStatus.PARTIAL)
            .map(DeliverySchedule::getDeliveryMonth)
            .findFirst()
            .orElse(YearMonth.from(trade.getEndDate()));

        BigDecimal marketPrice;
        try {
            marketPrice = pricingEngine.calculateMtmPrice(trade, deliveryMonth);
        } catch (Exception e) {
            log.debug("No forward price for trade {}, using last known", trade.getTradeReference());
            marketPrice = BigDecimal.ZERO;
        }

        BigDecimal tradePrice = pricingEngine.resolveUnitPrice(trade, trade.getTradeDate());
        BigDecimal openQty = trade.getDeliverySchedules().stream()
            .filter(ds -> ds.getStatus() != DeliveryStatus.COMPLETE && ds.getStatus() != DeliveryStatus.CANCELLED)
            .map(DeliverySchedule::getScheduledQuantity)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal mtmPriceUsd = marketPrice.subtract(tradePrice);
        // For sell trades, P&L is inverted
        boolean isSell = trade.getTradeType() == TradeType.PHYSICAL_SELL || trade.getTradeType() == TradeType.FINANCIAL_SELL;
        if (isSell) mtmPriceUsd = mtmPriceUsd.negate();

        BigDecimal mtmValueUsd = mtmPriceUsd.multiply(openQty).setScale(2, RoundingMode.HALF_UP);

        MtmValuation valuation = mtmRepo.findTopByTradeOrderByValuationDateDesc(trade)
            .filter(m -> m.getValuationDate().equals(valuationDate))
            .orElseGet(() -> MtmValuation.builder().trade(trade).valuationDate(valuationDate).build());

        valuation.setMarketPrice(marketPrice);
        valuation.setTradePrice(tradePrice);
        valuation.setMtmPriceUsd(mtmPriceUsd);
        valuation.setOpenQuantity(openQty);
        valuation.setMtmValueUsd(mtmValueUsd);
        valuation.setCalculatedAt(Instant.now());

        // Update trade's denormalized MTM
        trade.setMtmValueUsd(mtmValueUsd);
        trade.setUnrealizedPnlUsd(mtmValueUsd);
        tradeRepo.save(trade);

        return MtmValuationResponse.from(mtmRepo.save(valuation));
    }

    @Transactional(readOnly = true)
    public MtmValuationResponse getLatestMtm(Long tradeId) {
        Trade trade = tradeRepo.findById(tradeId)
            .orElseThrow(() -> new ResourceNotFoundException("Trade", tradeId));
        return mtmRepo.findTopByTradeOrderByValuationDateDesc(trade)
            .map(MtmValuationResponse::from)
            .orElseThrow(() -> new ResourceNotFoundException("MtmValuation for trade", tradeId));
    }

    @Transactional(readOnly = true)
    public List<MtmValuationResponse> getMtmHistory(Long tradeId, LocalDate from, LocalDate to) {
        Trade trade = tradeRepo.findById(tradeId)
            .orElseThrow(() -> new ResourceNotFoundException("Trade", tradeId));
        return mtmRepo.findByTradeAndValuationDateBetweenOrderByValuationDateAsc(trade, from, to)
            .stream().map(MtmValuationResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PnlResponse getPnlByBook(Long bookId, LocalDate date) {
        Book book = bookRepo.findById(bookId)
            .orElseThrow(() -> new ResourceNotFoundException("Book", bookId));
        return pnlRepo.findByBookAndCommodityAndSnapshotDate(book, null, date)
            .map(PnlResponse::from)
            .orElseGet(() -> computePnlOnDemand(book, null, date));
    }

    @Transactional
    public void createPnlSnapshot(LocalDate snapshotDate) {
        List<Trade> openTrades = tradeRepo.findAllOpenAsOf(snapshotDate);

        // Group by book + commodity
        Map<String, List<Trade>> grouped = openTrades.stream()
            .collect(Collectors.groupingBy(t -> t.getBook().getId() + ":" + t.getCommodity().getId()));

        for (Map.Entry<String, List<Trade>> entry : grouped.entrySet()) {
            List<Trade> trades = entry.getValue();
            if (trades.isEmpty()) continue;

            Book book = trades.get(0).getBook();
            Commodity commodity = trades.get(0).getCommodity();

            BigDecimal unrealized = trades.stream()
                .map(t -> t.getUnrealizedPnlUsd() != null ? t.getUnrealizedPnlUsd() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            PnlSnapshot existing = pnlRepo.findByBookAndCommodityAndSnapshotDate(book, commodity, snapshotDate)
                .orElseGet(() -> PnlSnapshot.builder().book(book).commodity(commodity).snapshotDate(snapshotDate).build());

            // Daily PnL = current unrealized - prior unrealized
            BigDecimal priorUnrealized = pnlRepo.findTopByBookAndCommodityOrderBySnapshotDateDesc(book, commodity)
                .filter(p -> !p.getSnapshotDate().equals(snapshotDate))
                .map(PnlSnapshot::getUnrealizedPnlUsd)
                .orElse(BigDecimal.ZERO);

            existing.setUnrealizedPnlUsd(unrealized);
            existing.setDailyPnlUsd(unrealized.subtract(priorUnrealized));
            existing.setCumulativePnlUsd(unrealized);
            existing.setTradeCount(trades.size());
            existing.setCalculatedAt(Instant.now());
            pnlRepo.save(existing);
        }
    }

    private PnlResponse computePnlOnDemand(Book book, Commodity commodity, LocalDate date) {
        // Compute from open trades if no snapshot exists
        List<Trade> trades = tradeRepo.findByBookAndStatus(book, TradeStatus.CONFIRMED);
        BigDecimal unrealized = trades.stream()
            .map(t -> t.getUnrealizedPnlUsd() != null ? t.getUnrealizedPnlUsd() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        PnlSnapshot synthetic = PnlSnapshot.builder()
            .book(book).commodity(commodity).snapshotDate(date)
            .unrealizedPnlUsd(unrealized).dailyPnlUsd(BigDecimal.ZERO)
            .cumulativePnlUsd(unrealized).realizedPnlUsd(BigDecimal.ZERO)
            .tradeCount(trades.size()).build();
        return PnlResponse.from(synthetic);
    }
}
