package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.RecordPaymentRequest;
import com.hedgelab.api.dto.response.InvoiceResponse;
import com.hedgelab.api.entity.InvoiceStatus;
import com.hedgelab.api.service.SettlementService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/settlements")
@RequiredArgsConstructor
@Tag(name = "Settlement", description = "Invoice generation, lifecycle, and payment recording")
public class SettlementController {

    private final SettlementService settlementService;

    @PostMapping("/invoices")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Generate an invoice for a trade delivery month")
    public InvoiceResponse generateInvoice(
            @RequestParam Long tradeId,
            @RequestParam String deliveryMonth) {
        return settlementService.generateInvoice(tradeId, YearMonth.parse(deliveryMonth));
    }

    @GetMapping("/invoices/{id}")
    @Operation(summary = "Get invoice by ID")
    public InvoiceResponse getById(@PathVariable Long id) {
        return settlementService.getById(id);
    }

    @GetMapping("/invoices")
    @Operation(summary = "List invoices by status")
    public List<InvoiceResponse> listByStatus(
            @RequestParam(required = false) InvoiceStatus status) {
        if (status == null) {
            status = InvoiceStatus.DRAFT;
        }
        return settlementService.getByStatus(status);
    }

    @PostMapping("/invoices/{id}/send")
    @Operation(summary = "Send a DRAFT invoice")
    public InvoiceResponse sendInvoice(@PathVariable Long id) {
        return settlementService.sendInvoice(id);
    }

    @PostMapping("/invoices/{id}/dispute")
    @Operation(summary = "Dispute a SENT invoice")
    public InvoiceResponse disputeInvoice(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return settlementService.disputeInvoice(id, body.get("reason"));
    }

    @PostMapping("/invoices/{id}/resolve")
    @Operation(summary = "Resolve a disputed invoice")
    public InvoiceResponse resolveDispute(@PathVariable Long id) {
        return settlementService.resolveDispute(id);
    }

    @PostMapping("/invoices/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Record a payment against an invoice")
    public InvoiceResponse recordPayment(
            @PathVariable Long id,
            @Valid @RequestBody RecordPaymentRequest req) {
        return settlementService.recordPayment(id, req);
    }
}
