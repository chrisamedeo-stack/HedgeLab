package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.PublishDailyPriceRequest;
import com.hedgelab.api.dto.response.DailyPriceResponse;
import com.hedgelab.api.dto.response.ForwardCurveResponse;
import com.hedgelab.api.entity.DailyPrice;
import com.hedgelab.api.entity.ForwardCurvePoint;
import com.hedgelab.api.entity.PriceIndex;
import com.hedgelab.api.exception.MarketDataNotFoundException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.DailyPriceRepository;
import com.hedgelab.api.repository.ForwardCurvePointRepository;
import com.hedgelab.api.repository.PriceIndexRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class MarketDataService {

    private final DailyPriceRepository dailyPriceRepo;
    private final ForwardCurvePointRepository fwdCurveRepo;
    private final PriceIndexRepository priceIndexRepo;

    @Transactional
    public DailyPriceResponse publishPrice(PublishDailyPriceRequest req) {
        PriceIndex idx = findIndex(req.indexCode());
        String priceType = req.priceType() != null ? req.priceType() : "SETTLE";

        DailyPrice dp = dailyPriceRepo
            .findByPriceIndexAndPriceDateAndPriceType(idx, req.priceDate(), priceType)
            .orElseGet(() -> DailyPrice.builder()
                .priceIndex(idx)
                .priceDate(req.priceDate())
                .priceType(priceType)
                .build());

        dp.setPrice(req.price());
        dp.setSource(req.source() != null ? req.source() : "MANUAL");
        dp.setConfirmed(true);
        dp.setPublishedAt(Instant.now());
        return DailyPriceResponse.from(dailyPriceRepo.save(dp));
    }

    @Transactional
    public List<DailyPriceResponse> publishPriceBatch(List<PublishDailyPriceRequest> requests) {
        return requests.stream().map(this::publishPrice).toList();
    }

    @Transactional(readOnly = true)
    public DailyPriceResponse getLatestPrice(String indexCode) {
        PriceIndex idx = findIndex(indexCode);
        return dailyPriceRepo.findTopByPriceIndexAndConfirmedTrueOrderByPriceDateDesc(idx)
            .map(DailyPriceResponse::from)
            .orElseThrow(() -> new MarketDataNotFoundException(indexCode, "latest"));
    }

    @Transactional(readOnly = true)
    public DailyPriceResponse getPriceForDate(String indexCode, LocalDate date) {
        PriceIndex idx = findIndex(indexCode);
        return dailyPriceRepo.findByPriceIndexAndPriceDateAndPriceType(idx, date, "SETTLE")
            .map(DailyPriceResponse::from)
            .orElseThrow(() -> new MarketDataNotFoundException(indexCode, date));
    }

    @Transactional(readOnly = true)
    public List<DailyPriceResponse> getPriceHistory(String indexCode, LocalDate from, LocalDate to) {
        PriceIndex idx = findIndex(indexCode);
        return dailyPriceRepo
            .findByPriceIndexAndPriceDateBetweenOrderByPriceDateAsc(idx, from, to)
            .stream().map(DailyPriceResponse::from).toList();
    }

    @Transactional
    public int publishForwardCurve(String indexCode, LocalDate curveDate, Map<YearMonth, BigDecimal> points) {
        PriceIndex idx = findIndex(indexCode);
        int saved = 0;
        for (Map.Entry<YearMonth, BigDecimal> entry : points.entrySet()) {
            ForwardCurvePoint fcp = fwdCurveRepo
                .findByPriceIndexAndCurveDateAndDeliveryMonth(idx, curveDate, entry.getKey())
                .orElseGet(() -> ForwardCurvePoint.builder()
                    .priceIndex(idx)
                    .curveDate(curveDate)
                    .deliveryMonth(entry.getKey())
                    .createdAt(Instant.now())
                    .build());
            fcp.setForwardPrice(entry.getValue());
            fwdCurveRepo.save(fcp);
            saved++;
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ForwardCurveResponse> getForwardCurve(String indexCode, LocalDate curveDate) {
        PriceIndex idx = findIndex(indexCode);
        return fwdCurveRepo.findByPriceIndexAndCurveDateOrderByDeliveryMonthAsc(idx, curveDate)
            .stream().map(ForwardCurveResponse::from).toList();
    }

    public BigDecimal resolveForwardPrice(PriceIndex priceIndex, YearMonth deliveryMonth) {
        LocalDate today = LocalDate.now();
        return fwdCurveRepo
            .findTopByPriceIndexAndDeliveryMonthOrderByCurveDateDesc(priceIndex, deliveryMonth)
            .map(ForwardCurvePoint::getForwardPrice)
            .or(() -> dailyPriceRepo
                .findTopByPriceIndexAndConfirmedTrueOrderByPriceDateDesc(priceIndex)
                .map(DailyPrice::getPrice))
            .orElseThrow(() -> new MarketDataNotFoundException(priceIndex.getIndexCode(), deliveryMonth));
    }

    private PriceIndex findIndex(String indexCode) {
        return priceIndexRepo.findByIndexCode(indexCode)
            .orElseThrow(() -> new ResourceNotFoundException("PriceIndex", indexCode));
    }
}
