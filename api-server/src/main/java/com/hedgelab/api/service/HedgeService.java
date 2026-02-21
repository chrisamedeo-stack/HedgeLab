package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateHedgeTradeRequest;
import com.hedgelab.api.dto.response.HedgeTradeResponse;
import com.hedgelab.api.entity.HedgeTrade;
import com.hedgelab.api.entity.HedgeTradeStatus;
import com.hedgelab.api.repository.HedgeAllocationRepository;
import com.hedgelab.api.repository.HedgeTradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HedgeService {
    private static final BigDecimal BUSHELS_PER_MT = new BigDecimal("39.3683");
    private static final int BUSHELS_PER_LOT = 5000;
    private final HedgeTradeRepository      hedgeRepository;
    private final HedgeAllocationRepository allocationRepository;

    public List<HedgeTradeResponse> getAllHedges() {
        return hedgeRepository.findAllByOrderByTradeDateDesc().stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public List<HedgeTradeResponse> getAllHedgesByBook(String book) {
        return hedgeRepository.findAllByOrderByTradeDateDesc().stream()
                .filter(h -> book.equalsIgnoreCase(h.getBook() != null ? h.getBook() : "CANADA"))
                .map(this::toResponse).collect(Collectors.toList());
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

    public HedgeTradeResponse update(Long id, CreateHedgeTradeRequest req) {
        HedgeTrade hedge = hedgeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hedge trade not found"));
        hedge.setFuturesMonth(req.getFuturesMonth());
        hedge.setLots(req.getLots());
        hedge.setPricePerBushel(req.getPricePerBushel());
        hedge.setBrokerAccount(req.getBrokerAccount());
        hedge.setTradeDate(req.getTradeDate());
        hedge.setOpenLots(req.getLots());
        hedge.setNotes(req.getNotes());
        if (req.getBook() != null) hedge.setBook(req.getBook().toUpperCase());
        return toResponse(hedgeRepository.save(hedge));
    }

    public void delete(Long id) {
        HedgeTrade hedge = hedgeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Hedge trade not found"));
        allocationRepository.deleteAll(allocationRepository.findByHedgeTrade_IdOrderByBudgetMonthAsc(id));
        hedgeRepository.delete(hedge);
    }

    private HedgeTradeResponse toResponse(HedgeTrade h) {
        BigDecimal equivMt = BigDecimal.valueOf((long) h.getLots() * BUSHELS_PER_LOT)
                .divide(BUSHELS_PER_MT, 4, RoundingMode.HALF_UP);
        int allocated   = allocationRepository.sumAllocatedLotsByTradeId(h.getId());
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
