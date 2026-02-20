package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.MtmValuationResponse;
import com.hedgelab.api.dto.response.PnlResponse;
import com.hedgelab.api.service.ValuationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/valuations")
@RequiredArgsConstructor
@Tag(name = "Valuations", description = "Mark-to-market valuations and P&L reporting")
public class ValuationController {

    private final ValuationService valuationService;

    @PostMapping("/eod")
    @Operation(summary = "Trigger end-of-day valuation for all open trades")
    public Map<String, Object> runEod(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate valuationDate) {
        LocalDate date = valuationDate != null ? valuationDate : LocalDate.now();
        int count = valuationService.runEodValuation(date);
        return Map.of("valuationDate", date.toString(), "tradesValuated", count);
    }

    @GetMapping("/trades/{tradeId}/mtm")
    @Operation(summary = "Get the latest MTM valuation for a trade")
    public MtmValuationResponse getLatestMtm(@PathVariable Long tradeId) {
        return valuationService.getLatestMtm(tradeId);
    }

    @GetMapping("/trades/{tradeId}/mtm/history")
    @Operation(summary = "Get MTM valuation history for a trade")
    public List<MtmValuationResponse> getMtmHistory(
            @PathVariable Long tradeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return valuationService.getMtmHistory(tradeId, from, to);
    }

    @GetMapping("/books/{bookId}/pnl")
    @Operation(summary = "Get P&L snapshot for a book")
    public PnlResponse getPnlByBook(
            @PathVariable Long bookId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return valuationService.getPnlByBook(bookId, date != null ? date : LocalDate.now());
    }

    @PostMapping("/pnl-snapshot")
    @Operation(summary = "Create P&L snapshots for all open trades")
    public Map<String, Object> createPnlSnapshot(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate snapshotDate) {
        LocalDate date = snapshotDate != null ? snapshotDate : LocalDate.now();
        valuationService.createPnlSnapshot(date);
        return Map.of("snapshotDate", date.toString(), "status", "created");
    }
}
