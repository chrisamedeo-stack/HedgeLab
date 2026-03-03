package com.hedgelab.v2.service.market;

import com.hedgelab.v2.entity.market.ForwardCurve;
import com.hedgelab.v2.entity.market.MarketPrice;
import com.hedgelab.v2.repository.market.ForwardCurveRepository;
import com.hedgelab.v2.repository.market.MarketPriceRepository;
import com.hedgelab.v2.service.kernel.AuditService;
import com.hedgelab.v2.service.kernel.EventBusService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MarketDataService {

    private final MarketPriceRepository priceRepo;
    private final ForwardCurveRepository curveRepo;
    private final AuditService auditService;
    private final EventBusService eventBusService;

    public List<MarketPrice> listPrices(String commodityId, String contractMonth,
                                         LocalDate dateFrom, LocalDate dateTo, String priceType) {
        return priceRepo.findFiltered(commodityId, contractMonth, dateFrom, dateTo, priceType);
    }

    public Optional<MarketPrice> getLatestPrice(String commodityId, String contractMonth) {
        return priceRepo.findLatestPrice(commodityId, contractMonth);
    }

    public List<MarketPrice> getLatestPrices(String commodityId) {
        return priceRepo.findLatestPricesByMonth(commodityId);
    }

    @Transactional
    public MarketPrice createPrice(MarketPrice price) {
        // Upsert: check if exists
        Optional<MarketPrice> existing = priceRepo.findByCommodityIdAndContractMonthAndPriceDateAndPriceType(
                price.getCommodityId(), price.getContractMonth(), price.getPriceDate(),
                price.getPriceType() != null ? price.getPriceType() : "settlement");

        if (existing.isPresent()) {
            MarketPrice e = existing.get();
            e.setPrice(price.getPrice());
            if (price.getOpenPrice() != null) e.setOpenPrice(price.getOpenPrice());
            if (price.getHighPrice() != null) e.setHighPrice(price.getHighPrice());
            if (price.getLowPrice() != null) e.setLowPrice(price.getLowPrice());
            if (price.getVolume() != null) e.setVolume(price.getVolume());
            if (price.getOpenInterest() != null) e.setOpenInterest(price.getOpenInterest());
            if (price.getSource() != null) e.setSource(price.getSource());
            return priceRepo.save(e);
        }

        if (price.getPriceType() == null) price.setPriceType("settlement");
        MarketPrice saved = priceRepo.save(price);

        eventBusService.emit(EventBusService.PRICE_UPDATED, "market_data",
                "price", saved.getId().toString(),
                Map.of("commodityId", saved.getCommodityId(),
                       "contractMonth", saved.getContractMonth(),
                       "price", saved.getPrice()),
                null, null);

        return saved;
    }

    @Transactional
    public List<MarketPrice> createPrices(List<MarketPrice> prices) {
        return prices.stream().map(this::createPrice).toList();
    }

    public List<ForwardCurve> getForwardCurve(String commodityId, LocalDate curveDate) {
        return curveRepo.findByCommodityIdAndCurveDateOrderByContractMonth(commodityId, curveDate);
    }
}
