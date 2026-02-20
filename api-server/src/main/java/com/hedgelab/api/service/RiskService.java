package com.hedgelab.api.service;

import com.hedgelab.api.dto.response.CreditUtilizationResponse;
import com.hedgelab.api.dto.response.RiskMetricResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiskService {

    private final CounterpartyRepository counterpartyRepo;
    private final CreditUtilizationRepository creditUtilRepo;
    private final RiskMetricRepository riskMetricRepo;
    private final TradeRepository tradeRepo;
    private final PositionRepository positionRepo;
    private final InvoiceRepository invoiceRepo;
    private final PricingEngineService pricingEngine;

    @Value("${hedgelab.risk.credit-amber-threshold:80}")
    private int amberThreshold;

    @Value("${hedgelab.risk.credit-red-threshold:95}")
    private int redThreshold;

    @Transactional
    public int recalculateAllCreditUtilizations(LocalDate snapshotDate) {
        List<Counterparty> active = counterpartyRepo.findAllActive();
        for (Counterparty cp : active) {
            try {
                recalculateCreditUtilization(cp, snapshotDate);
            } catch (Exception e) {
                log.warn("Failed to recalculate credit for {}: {}", cp.getLegalEntityCode(), e.getMessage());
            }
        }
        return active.size();
    }

    @Transactional
    public CreditUtilizationResponse recalculateCreditUtilization(Counterparty cp, LocalDate snapshotDate) {
        BigDecimal tradeExposure = tradeRepo.findOpenTradesByCounterparty(cp.getId())
            .stream()
            .map(t -> t.getNotionalUsd() != null ? t.getNotionalUsd() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal unpaidInvoices = invoiceRepo.sumUnpaidAmountByCounterparty(cp.getId());
        BigDecimal totalExposure = tradeExposure.add(unpaidInvoices);

        BigDecimal utilizationPct = BigDecimal.ZERO;
        if (cp.getCreditLimitUsd() != null && cp.getCreditLimitUsd().compareTo(BigDecimal.ZERO) > 0) {
            utilizationPct = totalExposure
                .divide(cp.getCreditLimitUsd(), 5, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100));
        }

        String alertLevel = "GREEN";
        int pct = utilizationPct.intValue();
        if (pct >= redThreshold) alertLevel = "RED";
        else if (pct >= amberThreshold) alertLevel = "AMBER";

        CreditUtilization cu = creditUtilRepo.findByCounterpartyAndSnapshotDate(cp, snapshotDate)
            .orElseGet(() -> CreditUtilization.builder().counterparty(cp).snapshotDate(snapshotDate).build());

        cu.setApprovedLimitUsd(cp.getCreditLimitUsd());
        cu.setCurrentExposureUsd(totalExposure);
        cu.setUtilizationPct(utilizationPct);
        cu.setAlertLevel(alertLevel);
        cu.setCalculatedAt(Instant.now());

        // Update denormalized field on counterparty
        cp.setCurrentExposureUsd(totalExposure);
        counterpartyRepo.save(cp);

        return CreditUtilizationResponse.from(creditUtilRepo.save(cu));
    }

    @Transactional(readOnly = true)
    public CreditUtilizationResponse getCreditUtilization(Long counterpartyId) {
        Counterparty cp = counterpartyRepo.findById(counterpartyId)
            .orElseThrow(() -> new ResourceNotFoundException("Counterparty", counterpartyId));
        return creditUtilRepo.findTopByCounterpartyOrderBySnapshotDateDesc(cp)
            .map(CreditUtilizationResponse::from)
            .orElseGet(() -> new CreditUtilizationResponse(
                cp.getId(), cp.getLegalEntityCode(), cp.getShortName(),
                LocalDate.now(), cp.getCreditLimitUsd(), cp.getCurrentExposureUsd(),
                BigDecimal.ZERO, "GREEN"
            ));
    }

    @Transactional
    public RiskMetricResponse calculateNetExposure(Long bookId, Long commodityId, LocalDate date) {
        Book book = new Book(); book.setId(bookId);
        Commodity commodity = new Commodity(); commodity.setId(commodityId);

        List<Position> positions = positionRepo.findByCommodityAndDeliveryMonth(
            commodity, YearMonth.from(date));

        BigDecimal totalNetQty = positions.stream()
            .filter(p -> p.getBook().getId().equals(bookId))
            .map(Position::getNetQuantity)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        RiskMetric metric = RiskMetric.builder()
            .book(book).commodity(commodity)
            .metricType(RiskMetricType.NET_EXPOSURE_USD)
            .metricDate(date)
            .metricValue(totalNetQty)
            .methodology("Net position in quantity units")
            .calculatedAt(Instant.now())
            .build();

        return RiskMetricResponse.from(riskMetricRepo.save(metric));
    }

    @Transactional(readOnly = true)
    public List<CreditUtilizationResponse> getAlertedCounterparties() {
        return creditUtilRepo.findLatestAlertedUtilizations()
            .stream().map(CreditUtilizationResponse::from).toList();
    }
}
