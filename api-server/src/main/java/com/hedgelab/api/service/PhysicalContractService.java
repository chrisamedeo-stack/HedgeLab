package com.hedgelab.api.service;

import com.hedgelab.api.dto.CommoditySpec;
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

    private final PhysicalContractRepository contractRepository;
    private final SiteRepository             siteRepository;
    private final EFPTicketRepository        efpTicketRepository;
    private final ReceiptTicketRepository    receiptTicketRepository;
    private final CommoditySpecService       specService;

    @Transactional(readOnly = true)
    public List<PhysicalContractResponse> getAllContracts(String commodityCode) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        return contractRepository.findAll().stream()
                .filter(c -> c.getCommodityCode() != null && c.getCommodityCode().startsWith(spec.code()))
                .map(c -> toResponse(c, spec))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PhysicalContractResponse> getBySite(String commodityCode, String siteCode) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        return contractRepository.findBySiteCodeOrderByContractDateDesc(siteCode)
                .stream()
                .filter(c -> c.getCommodityCode() != null && c.getCommodityCode().startsWith(spec.code()))
                .map(c -> toResponse(c, spec))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PhysicalContractResponse getById(Long id) {
        PhysicalContract contract = findOrThrow(id);
        CommoditySpec spec = resolveSpec(contract);
        return toResponse(contract, spec);
    }

    @Transactional
    public PhysicalContractResponse create(String commodityCode, CreatePhysicalContractRequest req) {
        CommoditySpec spec = specService.getSpec(commodityCode);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();

        var site = siteRepository.findByCode(req.getSiteCode())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Site not found: " + req.getSiteCode()));

        // Derive MT from Bu if needed
        BigDecimal mt = req.getQuantityMt();
        BigDecimal bu = req.getQuantityBu();
        if (mt == null && bu != null) {
            mt = bu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        } else if (bu == null && mt != null) {
            bu = mt.multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP);
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
            boardPrice = req.getBoardPricePerBu();
            basisLockedDate = req.getContractDate() != null ? req.getContractDate() : LocalDate.now();
            initialStatus = PhysicalContractStatus.BASIS_LOCKED;
        }

        var contract = PhysicalContract.builder()
                .contractRef(ref)
                .site(site)
                .supplierName(req.getSupplierName())
                .commodityCode(req.getCommodityCode() != null ? req.getCommodityCode() : spec.code())
                .quantityMt(mt)
                .deliveryMonth(req.getDeliveryMonth())
                .basisPerBu(req.getBasisPerBu())
                .futuresRef(req.getFuturesRef())
                .freightPerMt(req.getFreightPerMt())
                .currency(req.getCurrency() != null ? req.getCurrency() : "USD")
                .status(initialStatus)
                .boardPricePerBu(boardPrice)
                .basisLockedDate(basisLockedDate)
                .contractDate(req.getContractDate() != null ? req.getContractDate() : LocalDate.now())
                .notes(req.getNotes())
                .tradeType(tt)
                .build();

        return toResponse(contractRepository.save(contract), spec);
    }

    @Transactional
    public List<PhysicalContractResponse> createBulk(String commodityCode, List<CreatePhysicalContractRequest> requests) {
        return requests.stream().map(r -> create(commodityCode, r)).collect(Collectors.toList());
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
        contract.setBasisPerBu(req.getBasisPerBu());
        if (req.getFuturesRef() != null) contract.setFuturesRef(req.getFuturesRef());
        contract.setBasisLockedDate(req.getLockedDate() != null ? req.getLockedDate() : LocalDate.now());
        contract.setStatus(PhysicalContractStatus.BASIS_LOCKED);
        if (req.getNotes() != null) contract.setNotes(req.getNotes());
        CommoditySpec spec = resolveSpec(contract);
        return toResponse(contractRepository.save(contract), spec);
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
        CommoditySpec spec = resolveSpec(contract);
        return toResponse(contractRepository.save(contract), spec);
    }

    @Transactional
    public PhysicalContractResponse cancel(Long id) {
        var contract = findOrThrow(id);
        if (contract.getStatus() == PhysicalContractStatus.CLOSED) {
            throw new InvalidStateException("Cannot cancel a closed contract");
        }
        contract.setStatus(PhysicalContractStatus.CANCELLED);
        CommoditySpec spec = resolveSpec(contract);
        return toResponse(contractRepository.save(contract), spec);
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
        if (req.getBasisPerBu() != null) contract.setBasisPerBu(req.getBasisPerBu());
        if (req.getFreightPerMt() != null) contract.setFreightPerMt(req.getFreightPerMt());
        if (req.getBoardPricePerBu() != null) contract.setBoardPricePerBu(req.getBoardPricePerBu());

        // Update quantity
        CommoditySpec spec = resolveSpec(contract);
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal mt = req.getQuantityMt();
        BigDecimal bu = req.getQuantityBu();
        if (mt == null && bu != null) {
            mt = bu.divide(bushelsPerMt, 4, RoundingMode.HALF_UP);
        }
        if (mt != null) contract.setQuantityMt(mt);

        // Update trade type
        if (req.getTradeType() != null) {
            contract.setTradeType(parseTradeType(req.getTradeType()));
        }

        return toResponse(contractRepository.save(contract), spec);
    }

    @Transactional
    public void deleteContract(Long id) {
        var contract = findOrThrow(id);

        var efps = efpTicketRepository.findByPhysicalContractIdOrderByEfpDateDesc(id);
        if (!efps.isEmpty()) {
            throw new InvalidStateException(
                    "Cannot delete: contract has " + efps.size() + " linked EFP ticket(s). Delete them first.");
        }

        var receipts = receiptTicketRepository.findByPhysicalContractIdOrderByReceiptDateDesc(id);
        if (!receipts.isEmpty()) {
            throw new InvalidStateException(
                    "Cannot delete: contract has " + receipts.size() + " linked receipt(s). Delete them first.");
        }

        contractRepository.delete(contract);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CommoditySpec resolveSpec(PhysicalContract contract) {
        String code = contract.getCommodityCode();
        if (code == null || code.isBlank()) code = "CORN";
        if (code.contains("-")) code = code.split("-")[0];
        return specService.getSpec(code);
    }

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

    private PhysicalContractResponse toResponse(PhysicalContract c, CommoditySpec spec) {
        BigDecimal bushelsPerMt = spec.bushelsPerMt();
        BigDecimal bu = c.getQuantityMt() != null
                ? c.getQuantityMt().multiply(bushelsPerMt).setScale(2, RoundingMode.HALF_UP)
                : null;

        BigDecimal allInPerBu = null;
        BigDecimal allInPerMt = null;
        if (c.getBoardPricePerBu() != null) {
            BigDecimal basis   = c.getBasisPerBu() != null ? c.getBasisPerBu() : BigDecimal.ZERO;
            BigDecimal freight = c.getFreightPerMt()  != null ? c.getFreightPerMt()  : BigDecimal.ZERO;
            allInPerBu = c.getBoardPricePerBu().add(basis);
            allInPerMt = allInPerBu
                    .multiply(bushelsPerMt)
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
                .basisPerBu(c.getBasisPerBu()).futuresRef(c.getFuturesRef())
                .freightPerMt(c.getFreightPerMt()).currency(c.getCurrency())
                .status(c.getStatus().name())
                .boardPricePerBu(c.getBoardPricePerBu())
                .basisLockedDate(c.getBasisLockedDate())
                .allInPerBu(allInPerBu).allInPerMt(allInPerMt)
                .contractDate(c.getContractDate()).notes(c.getNotes())
                .tradeType(c.getTradeType() != null ? c.getTradeType().name() : "BASIS")
                .build();
    }
}
