package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.AmendTradeRequest;
import com.hedgelab.api.dto.request.CreateTradeRequest;
import com.hedgelab.api.dto.response.AuditLogResponse;
import com.hedgelab.api.dto.response.MtmValuationResponse;
import com.hedgelab.api.dto.response.PricingResultResponse;
import com.hedgelab.api.dto.response.TradeResponse;
import com.hedgelab.api.entity.AuditLog;
import com.hedgelab.api.entity.TradeStatus;
import com.hedgelab.api.repository.AuditLogRepository;
import com.hedgelab.api.service.TradeService;
import com.hedgelab.api.service.ValuationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/trades")
@RequiredArgsConstructor
@Tag(name = "Trades", description = "Trade capture, lifecycle management, and pricing")
public class TradeController {

    private final TradeService tradeService;
    private final ValuationService valuationService;
    private final AuditLogRepository auditLogRepo;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Capture a new trade in DRAFT status")
    public TradeResponse capture(@Valid @RequestBody CreateTradeRequest req) {
        return tradeService.capture(req);
    }

    @PostMapping("/{id}/confirm")
    @Operation(summary = "Confirm a DRAFT trade — runs pricing and credit check")
    public TradeResponse confirm(@PathVariable Long id) {
        return tradeService.confirm(id);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a trade and reverse its positions")
    public TradeResponse cancel(@PathVariable Long id) {
        return tradeService.cancel(id);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get trade by ID")
    public TradeResponse getById(@PathVariable Long id) {
        return tradeService.getById(id);
    }

    @GetMapping("/by-reference/{ref}")
    @Operation(summary = "Get trade by reference number")
    public TradeResponse getByReference(@PathVariable String ref) {
        return tradeService.getByReference(ref);
    }

    @GetMapping
    @Operation(summary = "Search trades with optional filters")
    public Page<TradeResponse> search(
            @RequestParam(required = false) TradeStatus status,
            @RequestParam(required = false) Long counterpartyId,
            @RequestParam(required = false) Long commodityId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @PageableDefault(size = 20) Pageable pageable) {
        return tradeService.search(status, counterpartyId, commodityId, from, to, pageable);
    }

    @GetMapping("/{id}/pricing")
    @Operation(summary = "Preview trade pricing as of a given date")
    public PricingResultResponse previewPricing(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOfDate) {
        return tradeService.previewPricing(id, asOfDate);
    }

    @GetMapping("/{id}/mtm")
    @Operation(summary = "Get the latest mark-to-market valuation for a trade")
    public MtmValuationResponse getLatestMtm(@PathVariable Long id) {
        return valuationService.getLatestMtm(id);
    }

    @PutMapping("/{id}/amend")
    @Operation(summary = "Amend a confirmed or previously amended trade")
    public TradeResponse amend(@PathVariable Long id,
                                @Valid @RequestBody AmendTradeRequest req,
                                @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return tradeService.amend(id, req, performedBy);
    }

    @GetMapping("/{id}/amendments")
    @Operation(summary = "Get amendment history for a trade")
    public Page<AuditLogResponse> getAmendments(@PathVariable Long id,
                                                 @PageableDefault(size = 20) Pageable pageable) {
        return auditLogRepo.findByEntityTypeAndEntityIdOrderByPerformedAtDesc("Trade", id, pageable)
                .map(AuditLogResponse::from);
    }
}
