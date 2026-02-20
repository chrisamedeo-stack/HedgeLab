package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateCounterpartyRequest;
import com.hedgelab.api.dto.response.CounterpartyResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.CounterpartyRepository;
import com.hedgelab.api.repository.InvoiceRepository;
import com.hedgelab.api.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CounterpartyService {

    private final CounterpartyRepository counterpartyRepo;
    private final TradeRepository tradeRepo;
    private final InvoiceRepository invoiceRepo;
    private final AuditLogService auditLogService;

    @Transactional
    public CounterpartyResponse create(CreateCounterpartyRequest req) {
        if (counterpartyRepo.existsByLegalEntityCode(req.legalEntityCode())) {
            throw new InvalidStateException("Legal entity code already exists: " + req.legalEntityCode());
        }
        if (counterpartyRepo.existsByShortName(req.shortName())) {
            throw new InvalidStateException("Short name already in use: " + req.shortName());
        }
        Counterparty cp = Counterparty.builder()
            .legalEntityCode(req.legalEntityCode().toUpperCase())
            .legalEntityIdentifier(req.legalEntityIdentifier())
            .shortName(req.shortName())
            .fullLegalName(req.fullLegalName())
            .type(req.type())
            .creditRating(req.creditRating())
            .creditLimitUsd(req.creditLimitUsd() != null ? req.creditLimitUsd() : BigDecimal.ZERO)
            .country(req.country())
            .registrationNumber(req.registrationNumber())
            .contactEmail(req.contactEmail())
            .contactPhone(req.contactPhone())
            .onboardedDate(req.onboardedDate())
            .internalNotes(req.internalNotes())
            .build();
        return CounterpartyResponse.from(counterpartyRepo.save(cp));
    }

    @Transactional(readOnly = true)
    public CounterpartyResponse getById(Long id) {
        return CounterpartyResponse.from(findById(id));
    }

    @Transactional(readOnly = true)
    public CounterpartyResponse getByCode(String code) {
        return CounterpartyResponse.from(counterpartyRepo.findByLegalEntityCode(code.toUpperCase())
            .orElseThrow(() -> new ResourceNotFoundException("Counterparty", code)));
    }

    @Transactional(readOnly = true)
    public List<CounterpartyResponse> getAll(CounterpartyStatus status, CounterpartyType type) {
        List<Counterparty> results;
        if (status != null && type != null) {
            results = counterpartyRepo.findByStatusAndType(status, type);
        } else if (status != null) {
            results = counterpartyRepo.findByStatus(status);
        } else {
            results = counterpartyRepo.findAll();
        }
        return results.stream().map(CounterpartyResponse::from).toList();
    }

    @Transactional
    public CounterpartyResponse update(Long id, CreateCounterpartyRequest req) {
        Counterparty cp = findById(id);
        cp.setFullLegalName(req.fullLegalName());
        cp.setShortName(req.shortName());
        cp.setType(req.type());
        cp.setCreditRating(req.creditRating());
        if (req.creditLimitUsd() != null) cp.setCreditLimitUsd(req.creditLimitUsd());
        cp.setCountry(req.country());
        cp.setContactEmail(req.contactEmail());
        cp.setContactPhone(req.contactPhone());
        cp.setInternalNotes(req.internalNotes());
        CounterpartyResponse result = CounterpartyResponse.from(counterpartyRepo.save(cp));
        auditLogService.log("Counterparty", id, AuditAction.UPDATE,
                "Counterparty updated: " + cp.getLegalEntityCode());
        return result;
    }

    @Transactional
    public CounterpartyResponse updateStatus(Long id, CounterpartyStatus newStatus) {
        Counterparty cp = findById(id);
        if (cp.getStatus() == newStatus) {
            throw new InvalidStateException("Counterparty already has status: " + newStatus);
        }
        CounterpartyStatus oldStatus = cp.getStatus();
        cp.setStatus(newStatus);
        CounterpartyResponse result = CounterpartyResponse.from(counterpartyRepo.save(cp));
        auditLogService.log("Counterparty", id, AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()), Map.of("status", newStatus.name()),
                "Counterparty status changed: " + cp.getLegalEntityCode());
        return result;
    }

    @Transactional
    public CounterpartyResponse updateCreditLimit(Long id, BigDecimal newLimit) {
        Counterparty cp = findById(id);
        if (newLimit.compareTo(BigDecimal.ZERO) < 0) {
            throw new InvalidStateException("Credit limit cannot be negative");
        }
        BigDecimal oldLimit = cp.getCreditLimitUsd();
        cp.setCreditLimitUsd(newLimit);
        CounterpartyResponse result = CounterpartyResponse.from(counterpartyRepo.save(cp));
        auditLogService.log("Counterparty", id, AuditAction.UPDATE,
                Map.of("creditLimitUsd", oldLimit), Map.of("creditLimitUsd", newLimit),
                "Credit limit updated: " + cp.getLegalEntityCode());
        return result;
    }

    public boolean checkCreditAvailability(Long counterpartyId, BigDecimal requestedExposureUsd) {
        Counterparty cp = findById(counterpartyId);
        if (cp.getCreditLimitUsd() == null || cp.getCreditLimitUsd().compareTo(BigDecimal.ZERO) == 0) {
            return true; // no limit set — allowed
        }
        BigDecimal available = cp.getCreditLimitUsd().subtract(
            cp.getCurrentExposureUsd() == null ? BigDecimal.ZERO : cp.getCurrentExposureUsd());
        return available.compareTo(requestedExposureUsd) >= 0;
    }

    @Transactional
    public void recalculateExposure(Long counterpartyId) {
        Counterparty cp = findById(counterpartyId);
        BigDecimal tradeExposure = tradeRepo.findOpenTradesByCounterparty(counterpartyId)
            .stream()
            .map(t -> t.getNotionalUsd() != null ? t.getNotionalUsd() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal unpaidInvoices = invoiceRepo.sumUnpaidAmountByCounterparty(counterpartyId);
        cp.setCurrentExposureUsd(tradeExposure.add(unpaidInvoices));
        counterpartyRepo.save(cp);
    }

    public Counterparty findById(Long id) {
        return counterpartyRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Counterparty", id));
    }
}
