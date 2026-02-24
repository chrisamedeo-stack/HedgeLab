package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateReceiptRequest;
import com.hedgelab.api.dto.response.ReceiptResponse;
import com.hedgelab.api.entity.ReceiptTicket;
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
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ReceiptService {
    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final BigDecimal SHRINK_BASE = new BigDecimal("15.5"); // standard moisture base
    private final ReceiptTicketRepository receiptRepository;
    private final PhysicalContractRepository contractRepository;
    private final SiteRepository siteRepository;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ReceiptResponse> getAllReceipts() {
        return receiptRepository.findAllByOrderByReceiptDateDesc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<ReceiptResponse> getBySite(String siteCode) {
        return receiptRepository.findBySiteCodeOrderByReceiptDateDesc(siteCode)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    public ReceiptResponse create(CreateReceiptRequest req) {
        var contract = contractRepository.findById(req.getPhysicalContractId()).orElseThrow();
        var site = siteRepository.findByCode(req.getSiteCode()).orElseThrow();
        long nextNum = receiptRepository.findMaxId() + 1;
        String ref = String.format("RT-%s-%d-%03d", req.getSiteCode(),
                req.getReceiptDate().getYear(), nextNum);
        // Calculate shrink from moisture
        BigDecimal moisture = req.getMoisturePct() != null ? req.getMoisturePct() : new BigDecimal("14.0");
        BigDecimal shrink = moisture.subtract(SHRINK_BASE).max(BigDecimal.ZERO)
                .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP);
        BigDecimal netMt = req.getGrossMt().multiply(BigDecimal.ONE.subtract(shrink))
                .setScale(4, RoundingMode.HALF_UP);
        BigDecimal netBushels = netMt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalCost = req.getDeliveredCostPerMt() != null
                ? netMt.multiply(req.getDeliveredCostPerMt()).setScale(2, RoundingMode.HALF_UP)
                : null;
        var receipt = ReceiptTicket.builder()
                .ticketRef(ref).physicalContract(contract).site(site)
                .receiptDate(req.getReceiptDate()).grossMt(req.getGrossMt())
                .netMt(netMt).moisturePct(moisture).shrinkFactor(shrink)
                .netBushels(netBushels).deliveredCostPerMt(req.getDeliveredCostPerMt())
                .totalCostUsd(totalCost).vehicleRef(req.getVehicleRef())
                .notes(req.getNotes()).build();
        return toResponse(receiptRepository.save(receipt));
    }

    @Transactional
    public ReceiptResponse update(Long id, CreateReceiptRequest req) {
        var receipt = receiptRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Receipt not found"));
        var contract = contractRepository.findById(req.getPhysicalContractId()).orElseThrow();
        var site = siteRepository.findByCode(req.getSiteCode()).orElseThrow();
        // Recalculate shrink/net/cost
        BigDecimal moisture = req.getMoisturePct() != null ? req.getMoisturePct() : new BigDecimal("14.0");
        BigDecimal shrink = moisture.subtract(SHRINK_BASE).max(BigDecimal.ZERO)
                .divide(new BigDecimal("100"), 6, RoundingMode.HALF_UP);
        BigDecimal netMt = req.getGrossMt().multiply(BigDecimal.ONE.subtract(shrink))
                .setScale(4, RoundingMode.HALF_UP);
        BigDecimal netBushels = netMt.multiply(BUSHELS_PER_MT).setScale(2, RoundingMode.HALF_UP);
        BigDecimal totalCost = req.getDeliveredCostPerMt() != null
                ? netMt.multiply(req.getDeliveredCostPerMt()).setScale(2, RoundingMode.HALF_UP)
                : null;
        receipt.setPhysicalContract(contract);
        receipt.setSite(site);
        receipt.setReceiptDate(req.getReceiptDate());
        receipt.setGrossMt(req.getGrossMt());
        receipt.setMoisturePct(moisture);
        receipt.setShrinkFactor(shrink);
        receipt.setNetMt(netMt);
        receipt.setNetBushels(netBushels);
        receipt.setDeliveredCostPerMt(req.getDeliveredCostPerMt());
        receipt.setTotalCostUsd(totalCost);
        receipt.setVehicleRef(req.getVehicleRef());
        receipt.setNotes(req.getNotes());
        return toResponse(receiptRepository.save(receipt));
    }

    @Transactional
    public void delete(Long id) {
        var receipt = receiptRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Receipt not found"));
        receiptRepository.delete(receipt);
    }

    private ReceiptResponse toResponse(ReceiptTicket r) {
        return ReceiptResponse.builder()
                .id(r.getId()).ticketRef(r.getTicketRef())
                .contractRef(r.getPhysicalContract().getContractRef())
                .siteCode(r.getSite().getCode()).siteName(r.getSite().getName())
                .receiptDate(r.getReceiptDate()).grossMt(r.getGrossMt())
                .netMt(r.getNetMt()).moisturePct(r.getMoisturePct())
                .netBushels(r.getNetBushels())
                .deliveredCostPerMt(r.getDeliveredCostPerMt())
                .totalCostUsd(r.getTotalCostUsd()).vehicleRef(r.getVehicleRef())
                .notes(r.getNotes()).build();
    }
}
