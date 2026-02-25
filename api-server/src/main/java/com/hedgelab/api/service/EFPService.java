package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateEFPRequest;
import com.hedgelab.api.dto.response.EFPTicketResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EFPService {
    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final int BUSHELS_PER_LOT = 5000;
    private final EFPTicketRepository efpRepository;
    private final HedgeTradeRepository hedgeRepository;
    private final PhysicalContractRepository contractRepository;
    private final HedgeOffsetRepository offsetRepository;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<EFPTicketResponse> getAllEFPs() {
        return efpRepository.findAllByOrderByEfpDateDesc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional
    public EFPTicketResponse create(CreateEFPRequest req) {
        var hedge = hedgeRepository.findById(req.getHedgeTradeId()).orElseThrow();
        var contract = contractRepository.findById(req.getPhysicalContractId()).orElseThrow();
        long nextNum = efpRepository.findMaxId() + 1;
        String ref = String.format("EFP-%d-%03d", req.getEfpDate().getYear(), nextNum);
        BigDecimal qtyMt = BigDecimal.valueOf((long) req.getLots() * BUSHELS_PER_LOT)
                .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        var efp = EFPTicket.builder()
                .ticketRef(ref).hedgeTrade(hedge).physicalContract(contract)
                .lots(req.getLots()).futuresMonth(hedge.getFuturesMonth())
                .boardPrice(req.getBoardPrice()).basisValue(req.getBasisValue())
                .quantityMt(qtyMt).efpDate(req.getEfpDate())
                .confirmationRef(req.getConfirmationRef())
                .status(EFPTicketStatus.CONFIRMED).notes(req.getNotes())
                .entryPrice(hedge.getPricePerBushel()).build();
        // Update hedge open lots and status
        int newOpenLots = Math.max(0, hedge.getOpenLots() - req.getLots());
        hedge.setOpenLots(newOpenLots);
        int offsetLots = offsetRepository.sumOffsetLotsByTradeId(hedge.getId());
        hedge.setStatus(HedgeService.computeStatus(hedge.getLots(), newOpenLots, offsetLots));
        hedgeRepository.save(hedge);
        // Update contract board price and status
        contract.setBoardPriceCentsBu(req.getBoardPrice());
        contract.setStatus(PhysicalContractStatus.EFP_EXECUTED);
        contractRepository.save(contract);
        return toResponse(efpRepository.save(efp));
    }

    @Transactional
    public void delete(Long id) {
        var efp = efpRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "EFP ticket not found"));
        // Restore hedge trade open lots and recompute status
        var hedge = efp.getHedgeTrade();
        int newOpenLots = hedge.getOpenLots() + efp.getLots();
        hedge.setOpenLots(newOpenLots);
        int offsetLots = offsetRepository.sumOffsetLotsByTradeId(hedge.getId());
        hedge.setStatus(HedgeService.computeStatus(hedge.getLots(), newOpenLots, offsetLots));
        hedgeRepository.save(hedge);
        efpRepository.delete(efp);
    }

    private EFPTicketResponse toResponse(EFPTicket e) {
        return EFPTicketResponse.builder()
                .id(e.getId()).ticketRef(e.getTicketRef())
                .hedgeTradeRef(e.getHedgeTrade().getTradeRef())
                .contractRef(e.getPhysicalContract().getContractRef())
                .siteName(e.getPhysicalContract().getSite().getName())
                .supplierName(e.getPhysicalContract().getSupplierName())
                .lots(e.getLots()).futuresMonth(e.getFuturesMonth())
                .boardPrice(e.getBoardPrice()).basisValue(e.getBasisValue())
                .quantityMt(e.getQuantityMt()).efpDate(e.getEfpDate())
                .confirmationRef(e.getConfirmationRef())
                .status(e.getStatus().name()).notes(e.getNotes()).build();
    }
}
