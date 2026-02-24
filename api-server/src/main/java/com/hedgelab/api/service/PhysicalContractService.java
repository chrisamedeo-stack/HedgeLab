package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreatePhysicalContractRequest;
import com.hedgelab.api.dto.request.LockBasisRequest;
import com.hedgelab.api.dto.request.UpdatePhysicalContractRequest;
import com.hedgelab.api.dto.response.PhysicalContractResponse;
import com.hedgelab.api.entity.PhysicalContract;
import com.hedgelab.api.entity.PhysicalContractStatus;
import com.hedgelab.api.entity.PhysicalContractTradeType;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.repository.EFPTicketRepository;
import com.hedgelab.api.repository.PhysicalContractRepository;
import com.hedgelab.api.repository.ReceiptTicketRepository;
import com.hedgelab.api.repository.SiteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PhysicalContractService {

    private static final BigDecimal BUSHELS_PER_MT   = new BigDecimal("39.3683");
    private static final BigDecimal CENTS_PER_DOLLAR = new BigDecimal("100");

    private final PhysicalContractRepository contractRepository;
    private final SiteRepository             siteRepository;
    private final EFPTicketRepository        efpTicketRepository;
    private final ReceiptTicketRepository    receiptTicketRepository;

    @Transactional(readOnly = true)
    public List<PhysicalContractResponse> getAllContracts() {
        return contractRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PhysicalContractResponse> getBySite(String siteCode) {
        return contractRepository.findBySiteCodeOrderByContractDateDesc(siteCode)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PhysicalContractResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional
    public PhysicalContractResponse create(CreatePhysicalContractRequest req) {
        var site = siteRepository.findByCode(req.getSiteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Site not found: " + req.getSiteCode()));

        // Derive MT from Bu if needed
        BigDecimal mt = req.getQuantityMt();
        BigDecimal bu = req.getQuantityBu();
        if (mt == null && bu != null) {
            mt = bu.divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        } else if (bu == null && mt != null) {
            bu = mt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
        }
        if (mt == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Provide quantityMt or quantityBu");

        long nextNum = contractRepository.findMaxId() + 1;
        String ref = String.format("PC-%s-%s-%03d",
                req.getSiteCode(),
                req.getDeliveryMonth() != null ? req.getDeliveryMonth().replace("-", "") : "0000",
                nextNum);

        PhysicalContractTradeType tt = parseTradeType(req.getTradeType());

        // ALL_IN: board + basis are locked at contract creation
        PhysicalContractStatus initialStatus = PhysicalContractStatus.OPEN;
        BigDecimal boardPrice = null;
        LocalDate basisLockedDate = null;
        if (tt == PhysicalContractTradeType.ALL_IN) {
            boardPrice = req.getBoardPriceCentsBu();
            basisLockedDate = req.getContractDate() != null ? req.getContractDate() : LocalDate.now();
            initialStatus = PhysicalContractStatus.BASIS_LOCKED;
        }

        var contract = PhysicalContract.builder()
                .contractRef(ref)
                .site(site)
                .supplierName(req.getSupplierName())
                .commodityCode(req.getCommodityCode() != null ? req.getCommodityCode() : "CORN-ZC")
                .quantityMt(mt)
                .deliveryMonth(req.getDeliveryMonth())
                .basisCentsBu(req.getBasisCentsBu())
                .futuresRef(req.getFuturesRef())
                .freightPerMt(req.getFreightPerMt())
                .currency(req.getCurrency() != null ? req.getCurrency() : "USD")
                .status(initialStatus)
                .boardPriceCentsBu(boardPrice)
                .basisLockedDate(basisLockedDate)
                .contractDate(req.getContractDate() != null ? req.getContractDate() : LocalDate.now())
                .notes(req.getNotes())
                .tradeType(tt)
                .build();

        return toResponse(contractRepository.save(contract));
    }

    @Transactional
    public PhysicalContractResponse lockBasis(Long id, LockBasisRequest req) {
        var contract = findOrThrow(id);
        if (contract.getStatus() == PhysicalContractStatus.EFP_EXECUTED
                || contract.getStatus() == PhysicalContractStatus.PO_ISSUED
                || contract.getStatus() == PhysicalContractStatus.CLOSED
                || contract.getStatus() == PhysicalContractStatus.CANCELLED) {
            throw new InvalidStateException(
                    "Cannot lock basis: contract is in status " + contract.getStatus());
        }
        contract.setBasisCentsBu(req.getBasisCentsBu());
        if (req.getFuturesRef() != null) contract.setFuturesRef(req.getFuturesRef());
        contract.setBasisLockedDate(req.getLockedDate() != null ? req.getLockedDate() : LocalDate.now());
        contract.setStatus(PhysicalContractStatus.BASIS_LOCKED);
        if (req.getNotes() != null) contract.setNotes(req.getNotes());
        return toResponse(contractRepository.save(contract));
    }

    @Transactional
    public PhysicalContractResponse issuePo(Long id) {
        var contract = findOrThrow(id);
        if (contract.getStatus() != PhysicalContractStatus.EFP_EXECUTED) {
            throw new InvalidStateException(
                    "Cannot issue PO: contract must be in EFP_EXECUTED status (currently "
                            + contract.getStatus() + ")");
        }
        contract.setStatus(PhysicalContractStatus.PO_ISSUED);
        return toResponse(contractRepository.save(contract));
    }

    @Transactional
    public PhysicalContractResponse cancel(Long id) {
        var contract = findOrThrow(id);
        if (contract.getStatus() == PhysicalContractStatus.CLOSED) {
            throw new InvalidStateException("Cannot cancel a closed contract");
        }
        contract.setStatus(PhysicalContractStatus.CANCELLED);
        return toResponse(contractRepository.save(contract));
    }

    @Transactional
    public PhysicalContractResponse update(Long id, UpdatePhysicalContractRequest req) {
        var contract = findOrThrow(id);
        if (contract.getStatus() == PhysicalContractStatus.CLOSED
                || contract.getStatus() == PhysicalContractStatus.CANCELLED) {
            throw new InvalidStateException(
                    "Cannot edit a contract in status " + contract.getStatus());
        }

        if (req.getSiteCode() != null) {
            var site = siteRepository.findByCode(req.getSiteCode())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Site not found: " + req.getSiteCode()));
            contract.setSite(site);
        }
        if (req.getSupplierName() != null) contract.setSupplierName(req.getSupplierName());
        if (req.getDeliveryMonth() != null) contract.setDeliveryMonth(req.getDeliveryMonth());
        if (req.getFuturesRef() != null) contract.setFuturesRef(req.getFuturesRef());
        if (req.getCurrency() != null) contract.setCurrency(req.getCurrency());
        if (req.getContractDate() != null) contract.setContractDate(req.getContractDate());
        if (req.getNotes() != null) contract.setNotes(req.getNotes());
        if (req.getBasisCentsBu() != null) contract.setBasisCentsBu(req.getBasisCentsBu());
        if (req.getFreightPerMt() != null) contract.setFreightPerMt(req.getFreightPerMt());
        if (req.getBoardPriceCentsBu() != null) contract.setBoardPriceCentsBu(req.getBoardPriceCentsBu());

        // Update quantity
        BigDecimal mt = req.getQuantityMt();
        BigDecimal bu = req.getQuantityBu();
        if (mt == null && bu != null) {
            mt = bu.divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        }
        if (mt != null) contract.setQuantityMt(mt);

        // Update trade type
        if (req.getTradeType() != null) {
            contract.setTradeType(parseTradeType(req.getTradeType()));
        }

        return toResponse(contractRepository.save(contract));
    }

    @Transactional
    public void deleteContract(Long id) {
        var contract = findOrThrow(id);

        // Check for linked EFP tickets
        var efps = efpTicketRepository.findByPhysicalContractIdOrderByEfpDateDesc(id);
        if (!efps.isEmpty()) {
            throw new InvalidStateException(
                    "Cannot delete: contract has " + efps.size() + " linked EFP ticket(s). Delete them first.");
        }

        // Check for linked receipt tickets
        var receipts = receiptTicketRepository.findByPhysicalContractIdOrderByReceiptDateDesc(id);
        if (!receipts.isEmpty()) {
            throw new InvalidStateException(
                    "Cannot delete: contract has " + receipts.size() + " linked receipt(s). Delete them first.");
        }

        contractRepository.delete(contract);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PhysicalContractTradeType parseTradeType(String tradeType) {
        if (tradeType == null || tradeType.isBlank()) return PhysicalContractTradeType.BASIS;
        try {
            return PhysicalContractTradeType.valueOf(tradeType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return PhysicalContractTradeType.BASIS;
        }
    }

    private PhysicalContract findOrThrow(Long id) {
        return contractRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Contract not found: " + id));
    }

    private PhysicalContractResponse toResponse(PhysicalContract c) {
        BigDecimal bu = c.getQuantityMt() != null
                ? c.getQuantityMt().multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP)
                : null;

        BigDecimal allInCents = null;
        BigDecimal allInPerMt = null;
        if (c.getBoardPriceCentsBu() != null) {
            BigDecimal basis   = c.getBasisCentsBu() != null ? c.getBasisCentsBu() : BigDecimal.ZERO;
            BigDecimal freight = c.getFreightPerMt()  != null ? c.getFreightPerMt()  : BigDecimal.ZERO;
            allInCents = c.getBoardPriceCentsBu().add(basis);
            allInPerMt = allInCents
                    .divide(CENTS_PER_DOLLAR, 6, RoundingMode.HALF_UP)
                    .multiply(BUSHELS_PER_MT)
                    .add(freight)
                    .setScale(2, RoundingMode.HALF_UP);
        }

        return PhysicalContractResponse.builder()
                .id(c.getId()).contractRef(c.getContractRef())
                .siteCode(c.getSite().getCode()).siteName(c.getSite().getName())
                .supplierName(c.getSupplierName())
                .commodityCode(c.getCommodityCode())
                .quantityMt(c.getQuantityMt()).quantityBu(bu)
                .deliveryMonth(c.getDeliveryMonth())
                .basisCentsBu(c.getBasisCentsBu()).futuresRef(c.getFuturesRef())
                .freightPerMt(c.getFreightPerMt()).currency(c.getCurrency())
                .status(c.getStatus().name())
                .boardPriceCentsBu(c.getBoardPriceCentsBu())
                .basisLockedDate(c.getBasisLockedDate())
                .allInCentsBu(allInCents).allInPerMt(allInPerMt)
                .contractDate(c.getContractDate()).notes(c.getNotes())
                .tradeType(c.getTradeType() != null ? c.getTradeType().name() : "BASIS")
                .build();
    }
}
