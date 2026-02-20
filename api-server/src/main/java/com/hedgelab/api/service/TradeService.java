package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.AmendTradeRequest;
import com.hedgelab.api.dto.request.CreateTradeRequest;
import com.hedgelab.api.dto.response.PricingResultResponse;
import com.hedgelab.api.dto.response.TradeResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.InsufficientCreditException;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class TradeService {

    private final TradeRepository tradeRepo;
    private final CounterpartyService counterpartyService;
    private final CommodityService commodityService;
    private final BookService bookService;
    private final PriceIndexService priceIndexService;
    private final PriceFormulaRepository formulaRepo;
    private final PricingEngineService pricingEngine;
    private final PositionService positionService;
    private final AuditLogService auditLogService;

    @Value("${hedgelab.trade.reference-prefix:HL}")
    private String refPrefix;

    @Transactional
    public TradeResponse capture(CreateTradeRequest req) {
        Counterparty cp = counterpartyService.findById(req.counterpartyId());
        if (cp.getStatus() == CounterpartyStatus.BLACKLISTED) {
            throw new InvalidStateException("Counterparty is blacklisted: " + cp.getShortName());
        }
        if (cp.getStatus() == CounterpartyStatus.SUSPENDED) {
            throw new InvalidStateException("Counterparty is suspended: " + cp.getShortName());
        }

        Commodity commodity = commodityService.findById(req.commodityId());
        if (!commodity.isActive()) {
            throw new InvalidStateException("Commodity is inactive: " + commodity.getCode());
        }

        Book book = bookService.findById(req.bookId());

        if (req.startDate().isAfter(req.endDate())) {
            throw new InvalidStateException("Start date must be before end date");
        }

        // Resolve pricing references
        PriceIndex priceIndex = null;
        PriceFormula priceFormula = null;
        if (req.pricingType() == PricingType.FIXED && req.fixedPrice() == null) {
            throw new InvalidStateException("Fixed price required for FIXED pricing type");
        }
        if (req.pricingType() == PricingType.INDEX) {
            if (req.priceIndexId() == null) throw new InvalidStateException("Price index required for INDEX pricing type");
            priceIndex = priceIndexService.findById(req.priceIndexId());
        }
        if (req.pricingType() == PricingType.FORMULA) {
            if (req.priceFormulaId() == null) throw new InvalidStateException("Formula required for FORMULA pricing type");
            priceFormula = formulaRepo.findById(req.priceFormulaId())
                .orElseThrow(() -> new ResourceNotFoundException("PriceFormula", req.priceFormulaId()));
        }

        Trade trade = Trade.builder()
            .tradeReference(generateReference())
            .tradeType(req.tradeType())
            .counterparty(cp)
            .commodity(commodity)
            .book(book)
            .tradeDate(req.tradeDate())
            .startDate(req.startDate())
            .endDate(req.endDate())
            .quantity(req.quantity())
            .quantityUnit(req.quantityUnit())
            .pricingType(req.pricingType())
            .fixedPrice(req.fixedPrice())
            .priceIndex(priceIndex)
            .priceFormula(priceFormula)
            .spread(req.spread() != null ? req.spread() : BigDecimal.ZERO)
            .currency(req.currency().toUpperCase())
            .externalReference(req.externalReference())
            .internalNotes(req.internalNotes())
            .build();

        // Build delivery schedules (monthly breakdown)
        List<DeliverySchedule> schedules = buildDeliverySchedules(trade, req.startDate(), req.endDate(), req.quantity());
        trade.setDeliverySchedules(schedules);

        Trade saved = tradeRepo.save(trade);
        auditLogService.log("Trade", saved.getId(), AuditAction.CREATE,
                "Trade captured: " + saved.getTradeReference());
        return TradeResponse.from(saved);
    }

    @Transactional
    public TradeResponse confirm(Long id) {
        Trade trade = findById(id);
        if (trade.getStatus() != TradeStatus.DRAFT) {
            throw new InvalidStateException("Only DRAFT trades can be confirmed. Current status: " + trade.getStatus());
        }

        // Price the trade and calculate notional
        PricingResultResponse pricing = pricingEngine.calculate(trade, trade.getTradeDate());
        BigDecimal notional = pricing.notionalUsd();

        // Check credit availability
        if (!counterpartyService.checkCreditAvailability(trade.getCounterparty().getId(), notional)) {
            throw new InsufficientCreditException(
                trade.getCounterparty().getLegalEntityCode(),
                "Requested exposure: " + notional + " USD"
            );
        }

        TradeStatus oldStatus = trade.getStatus();
        trade.setNotionalUsd(notional);
        trade.setStatus(TradeStatus.CONFIRMED);
        Trade saved = tradeRepo.save(trade);

        // Update positions
        positionService.updatePosition(saved, false);
        // Update counterparty exposure
        counterpartyService.recalculateExposure(trade.getCounterparty().getId());

        auditLogService.log("Trade", saved.getId(), AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()),
                Map.of("status", TradeStatus.CONFIRMED.name(), "notionalUsd", notional),
                "Trade confirmed: " + saved.getTradeReference());
        return TradeResponse.from(saved);
    }

    @Transactional
    public TradeResponse cancel(Long id) {
        Trade trade = findById(id);
        if (trade.getStatus() == TradeStatus.SETTLED || trade.getStatus() == TradeStatus.CANCELLED) {
            throw new InvalidStateException("Cannot cancel trade with status: " + trade.getStatus());
        }
        TradeStatus oldStatus = trade.getStatus();
        boolean wasConfirmed = oldStatus == TradeStatus.CONFIRMED;
        trade.setStatus(TradeStatus.CANCELLED);
        Trade saved = tradeRepo.save(trade);

        if (wasConfirmed) {
            positionService.updatePosition(saved, true); // reverse
            counterpartyService.recalculateExposure(trade.getCounterparty().getId());
        }
        auditLogService.log("Trade", saved.getId(), AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()),
                Map.of("status", TradeStatus.CANCELLED.name()),
                "Trade cancelled: " + saved.getTradeReference());
        return TradeResponse.from(saved);
    }

    @Transactional
    public TradeResponse amend(Long id, AmendTradeRequest req, String performedBy) {
        Trade trade = findById(id);
        if (trade.getStatus() != TradeStatus.CONFIRMED && trade.getStatus() != TradeStatus.AMENDED) {
            throw new InvalidStateException("Only CONFIRMED or AMENDED trades can be amended. Status: " + trade.getStatus());
        }

        Map<String, Object> oldSnapshot = Map.of(
            "quantity",    trade.getQuantity(),
            "fixedPrice",  trade.getFixedPrice() != null ? trade.getFixedPrice() : "null",
            "startDate",   trade.getStartDate().toString(),
            "endDate",     trade.getEndDate().toString(),
            "status",      trade.getStatus().name()
        );

        boolean datesChanged = false;
        if (req.quantity() != null)   { trade.setQuantity(req.quantity()); }
        if (req.fixedPrice() != null) { trade.setFixedPrice(req.fixedPrice()); }
        if (req.startDate() != null)  { trade.setStartDate(req.startDate()); datesChanged = true; }
        if (req.endDate() != null)    { trade.setEndDate(req.endDate()); datesChanged = true; }

        trade.setStatus(TradeStatus.AMENDED);
        trade.setAmendmentCount(trade.getAmendmentCount() == null ? 1 : trade.getAmendmentCount() + 1);
        trade.setAmendedAt(Instant.now());
        trade.setAmendedBy(performedBy);
        trade.setAmendmentReason(req.amendmentReason());

        if (datesChanged) {
            // Rebuild delivery schedules for new date range
            trade.getDeliverySchedules().clear();
            List<DeliverySchedule> newSchedules = buildDeliverySchedules(
                trade, trade.getStartDate(), trade.getEndDate(), trade.getQuantity());
            trade.getDeliverySchedules().addAll(newSchedules);
            // Reverse old positions and rebuild
            positionService.updatePosition(trade, true);
        }

        Trade saved = tradeRepo.save(trade);

        if (datesChanged) {
            positionService.updatePosition(saved, false);
        }

        // Recalculate notional
        try {
            PricingResultResponse pricing = pricingEngine.calculate(saved, saved.getTradeDate());
            saved.setNotionalUsd(pricing.notionalUsd());
            saved = tradeRepo.save(saved);
        } catch (Exception ignored) { /* price data may not be available for all amendment scenarios */ }

        counterpartyService.recalculateExposure(saved.getCounterparty().getId());

        Map<String, Object> newSnapshot = Map.of(
            "quantity",    saved.getQuantity(),
            "fixedPrice",  saved.getFixedPrice() != null ? saved.getFixedPrice() : "null",
            "startDate",   saved.getStartDate().toString(),
            "endDate",     saved.getEndDate().toString(),
            "status",      saved.getStatus().name()
        );
        auditLogService.log("Trade", saved.getId(), AuditAction.AMEND,
                oldSnapshot, newSnapshot,
                "Trade amended by " + performedBy + ": " + req.amendmentReason());
        return TradeResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public TradeResponse getById(Long id) {
        return TradeResponse.from(findById(id));
    }

    @Transactional(readOnly = true)
    public TradeResponse getByReference(String ref) {
        return TradeResponse.from(tradeRepo.findByTradeReference(ref)
            .orElseThrow(() -> new ResourceNotFoundException("Trade", ref)));
    }

    @Transactional(readOnly = true)
    public Page<TradeResponse> search(TradeStatus status, Long counterpartyId, Long commodityId,
                                       LocalDate from, LocalDate to, Pageable pageable) {
        // Simple filter: if status provided, use it; else return all
        if (status != null) {
            return tradeRepo.findAll(
                (root, query, cb) -> {
                    var predicates = new ArrayList<>();
                    predicates.add(cb.equal(root.get("status"), status));
                    if (counterpartyId != null) predicates.add(cb.equal(root.get("counterparty").get("id"), counterpartyId));
                    if (commodityId != null) predicates.add(cb.equal(root.get("commodity").get("id"), commodityId));
                    if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("tradeDate"), from));
                    if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("tradeDate"), to));
                    return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
                }, pageable
            ).map(TradeResponse::from);
        }
        return tradeRepo.findAll(pageable).map(TradeResponse::from);
    }

    @Transactional(readOnly = true)
    public PricingResultResponse previewPricing(Long id, LocalDate asOfDate) {
        Trade trade = findById(id);
        return pricingEngine.calculate(trade, asOfDate != null ? asOfDate : LocalDate.now());
    }

    private String generateReference() {
        String dateStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        long count = tradeRepo.count() + 1;
        return String.format("%s-%s-%05d", refPrefix, dateStr, count);
    }

    private List<DeliverySchedule> buildDeliverySchedules(Trade trade, LocalDate start, LocalDate end, BigDecimal totalQty) {
        List<DeliverySchedule> schedules = new ArrayList<>();
        YearMonth startMonth = YearMonth.from(start);
        YearMonth endMonth = YearMonth.from(end);
        long totalMonths = startMonth.until(endMonth.plusMonths(1), java.time.temporal.ChronoUnit.MONTHS);
        BigDecimal qtyPerMonth = totalQty.divide(BigDecimal.valueOf(Math.max(totalMonths, 1)), 6, java.math.RoundingMode.HALF_UP);

        YearMonth current = startMonth;
        while (!current.isAfter(endMonth)) {
            schedules.add(DeliverySchedule.builder()
                .trade(trade)
                .deliveryMonth(current)
                .scheduledQuantity(qtyPerMonth)
                .build());
            current = current.plusMonths(1);
        }
        return schedules;
    }

    public Trade findById(Long id) {
        return tradeRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Trade", id));
    }
}
