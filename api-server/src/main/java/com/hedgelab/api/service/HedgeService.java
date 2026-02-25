package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateHedgeTradeRequest;
import com.hedgelab.api.dto.response.HedgeTradeResponse;
import com.hedgelab.api.entity.HedgeTrade;
import com.hedgelab.api.entity.HedgeTradeStatus;
import com.hedgelab.api.repository.EFPTicketRepository;
import com.hedgelab.api.repository.HedgeAllocationRepository;
import com.hedgelab.api.repository.HedgeOffsetRepository;
import com.hedgelab.api.repository.HedgeTradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HedgeService {
    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final int BUSHELS_PER_LOT = 5000;
    private final HedgeTradeRepository      hedgeRepository;
    private final HedgeAllocationRepository allocationRepository;
    private final EFPTicketRepository       efpRepository;
    private final HedgeOffsetRepository     offsetRepository;

    public List<HedgeTradeResponse> getAllHedges() {
        return toResponses(hedgeRepository.findAllByOrderByTradeDateDesc());
    }

    public List<HedgeTradeResponse> getAllHedgesByBook(String book) {
        String resolved = book != null ? book.toUpperCase() : "CANADA";
        return toResponses(hedgeRepository.findByBookOrderByTradeDateDesc(resolved));
    }

    public HedgeTradeResponse create(CreateHedgeTradeRequest req) {
        long nextNum = hedgeRepository.findMaxId() + 1;
        String ref = String.format("HT-%d-%03d", req.getTradeDate().getYear(), nextNum);
        String book = req.getBook() != null ? req.getBook().toUpperCase() : "CANADA";
        var hedge = HedgeTrade.builder()
                .tradeRef(ref).futuresMonth(req.getFuturesMonth()).lots(req.getLots())
                .pricePerBushel(req.getPricePerBushel()).brokerAccount(req.getBrokerAccount())
                .tradeDate(req.getTradeDate()).status(HedgeTradeStatus.OPEN)
                .openLots(req.getLots()).book(book).notes(req.getNotes()).build();
        return toResponse(hedgeRepository.save(hedge));
    }

    @Transactional
    public List<HedgeTradeResponse> createBulk(List<CreateHedgeTradeRequest> requests) {
        return requests.stream().map(this::create).collect(Collectors.toList());
    }

    @Transactional
    public HedgeTradeResponse update(Long id, CreateHedgeTradeRequest req) {
        HedgeTrade hedge = hedgeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hedge trade not found"));

        int oldLots = hedge.getLots() != null ? hedge.getLots() : 0;
        int newLots = req.getLots() != null ? req.getLots() : oldLots;
        boolean lotsChanged = newLots != oldLots;

        if (lotsChanged) {
            int efpLots      = efpRepository.sumLotsByHedgeTradeId(id);
            int offsetLots   = offsetRepository.sumOffsetLotsByTradeId(id);
            int consumedLots = efpLots + offsetLots;
            int allocatedLots = allocationRepository.sumAllocatedLotsByTradeId(id);

            if (newLots < consumedLots) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot reduce lots to " + newLots + ": " + consumedLots
                                + " lots already consumed by EFPs/offsets");
            }
            if (newLots < allocatedLots) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot reduce lots to " + newLots + ": " + allocatedLots
                                + " lots already allocated to sites");
            }

            hedge.setLots(newLots);
            hedge.setOpenLots(newLots - consumedLots);
        }

        hedge.setFuturesMonth(req.getFuturesMonth());
        hedge.setPricePerBushel(req.getPricePerBushel());
        hedge.setBrokerAccount(req.getBrokerAccount());
        hedge.setTradeDate(req.getTradeDate());
        hedge.setNotes(req.getNotes());
        if (req.getBook() != null) hedge.setBook(req.getBook().toUpperCase());

        hedge.setStatus(computeStatus(hedge));
        return toResponse(hedgeRepository.save(hedge));
    }

    @Transactional
    public void delete(Long id) {
        HedgeTrade hedge = hedgeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hedge trade not found"));

        int efpLots = efpRepository.sumLotsByHedgeTradeId(id);
        if (efpLots > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete hedge with " + efpLots + " EFP lots. Delete those EFPs first");
        }

        int offsetLots = offsetRepository.sumOffsetLotsByTradeId(id);
        if (offsetLots > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot delete hedge with " + offsetLots + " offset lots. Delete those offsets first");
        }

        allocationRepository.deleteAll(allocationRepository.findByHedgeTrade_IdOrderByBudgetMonthAsc(id));
        hedgeRepository.delete(hedge);
    }

    static HedgeTradeStatus computeStatus(int totalLots, int openLots, int offsetLots) {
        if (openLots <= 0) {
            return offsetLots >= totalLots ? HedgeTradeStatus.CLOSED : HedgeTradeStatus.FULLY_ALLOCATED;
        }
        if (openLots < totalLots) return HedgeTradeStatus.PARTIALLY_ALLOCATED;
        return HedgeTradeStatus.OPEN;
    }

    private HedgeTradeStatus computeStatus(HedgeTrade hedge) {
        int totalLots  = hedge.getLots() != null ? hedge.getLots() : 0;
        int openLots   = hedge.getOpenLots() != null ? hedge.getOpenLots() : 0;
        int offsetLots = offsetRepository.sumOffsetLotsByTradeId(hedge.getId());
        return computeStatus(totalLots, openLots, offsetLots);
    }

    private List<HedgeTradeResponse> toResponses(List<HedgeTrade> hedges) {
        if (hedges.isEmpty()) return Collections.emptyList();
        List<Long> ids = hedges.stream().map(HedgeTrade::getId).collect(Collectors.toList());
        Map<Long, Integer> allocMap = allocationRepository.sumAllocatedLotsByTradeIds(ids)
                .stream().collect(Collectors.toMap(r -> (Long) r[0], r -> ((Number) r[1]).intValue()));
        return hedges.stream().map(h -> toResponse(h, allocMap.getOrDefault(h.getId(), 0)))
                .collect(Collectors.toList());
    }

    private HedgeTradeResponse toResponse(HedgeTrade h) {
        return toResponse(h, allocationRepository.sumAllocatedLotsByTradeId(h.getId()));
    }

    private HedgeTradeResponse toResponse(HedgeTrade h, int allocated) {
        BigDecimal equivMt = BigDecimal.valueOf((long) h.getLots() * BUSHELS_PER_LOT)
                .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        int unallocated = Math.max(0, (h.getLots() != null ? h.getLots() : 0) - allocated);
        return HedgeTradeResponse.builder()
                .id(h.getId()).tradeRef(h.getTradeRef()).futuresMonth(h.getFuturesMonth())
                .lots(h.getLots()).openLots(h.getOpenLots())
                .allocatedLots(allocated).unallocatedLots(unallocated)
                .pricePerBushel(h.getPricePerBushel()).brokerAccount(h.getBrokerAccount())
                .tradeDate(h.getTradeDate()).status(h.getStatus().name())
                .equivalentMt(equivMt).book(h.getBook() != null ? h.getBook() : "CANADA")
                .notes(h.getNotes()).build();
    }
}
