package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.RecordPaymentRequest;
import com.hedgelab.api.dto.response.InvoiceResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.InvoiceRepository;
import com.hedgelab.api.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SettlementService {

    private final InvoiceRepository invoiceRepo;
    private final PaymentRepository paymentRepo;
    private final TradeService tradeService;
    private final PricingEngineService pricingEngine;
    private final CounterpartyService counterpartyService;
    private final AuditLogService auditLogService;

    @Transactional
    public InvoiceResponse generateInvoice(Long tradeId, YearMonth deliveryMonth) {
        Trade trade = tradeService.findById(tradeId);
        if (trade.getStatus() == TradeStatus.CANCELLED) {
            throw new InvalidStateException("Cannot invoice a cancelled trade");
        }

        DeliverySchedule schedule = trade.getDeliverySchedules().stream()
            .filter(ds -> ds.getDeliveryMonth().equals(deliveryMonth))
            .findFirst()
            .orElseThrow(() -> new InvalidStateException(
                "No delivery schedule for month: " + deliveryMonth));

        BigDecimal unitPrice = pricingEngine.resolveUnitPrice(trade, trade.getTradeDate());
        BigDecimal subtotal = schedule.getScheduledQuantity().multiply(unitPrice)
            .setScale(2, java.math.RoundingMode.HALF_UP);

        Invoice invoice = Invoice.builder()
            .invoiceNumber(generateInvoiceNumber())
            .trade(trade)
            .counterparty(trade.getCounterparty())
            .invoiceDate(LocalDate.now())
            .dueDate(LocalDate.now().plusDays(30))
            .deliveryMonth(deliveryMonth)
            .invoicedQuantity(schedule.getScheduledQuantity())
            .unitPrice(unitPrice)
            .subtotalUsd(subtotal)
            .totalAmountUsd(subtotal)
            .currency(trade.getCurrency())
            .build();

        Invoice saved = invoiceRepo.save(invoice);
        auditLogService.log("Invoice", saved.getId(), AuditAction.CREATE,
                "Invoice generated: " + saved.getInvoiceNumber() + " for trade " + trade.getTradeReference());
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public InvoiceResponse sendInvoice(Long invoiceId) {
        Invoice inv = findById(invoiceId);
        if (inv.getStatus() != InvoiceStatus.DRAFT) {
            throw new InvalidStateException("Only DRAFT invoices can be sent. Status: " + inv.getStatus());
        }
        InvoiceStatus oldStatus = inv.getStatus();
        inv.setStatus(InvoiceStatus.SENT);
        Invoice saved = invoiceRepo.save(inv);
        auditLogService.log("Invoice", invoiceId, AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()), Map.of("status", "SENT"),
                "Invoice sent: " + inv.getInvoiceNumber());
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public InvoiceResponse disputeInvoice(Long invoiceId, String reason) {
        Invoice inv = findById(invoiceId);
        if (inv.getStatus() != InvoiceStatus.SENT) {
            throw new InvalidStateException("Only SENT invoices can be disputed. Status: " + inv.getStatus());
        }
        InvoiceStatus oldStatus = inv.getStatus();
        inv.setStatus(InvoiceStatus.DISPUTED);
        inv.setDisputeReason(reason);
        Invoice saved = invoiceRepo.save(inv);
        auditLogService.log("Invoice", invoiceId, AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()), Map.of("status", "DISPUTED", "reason", reason),
                "Invoice disputed: " + inv.getInvoiceNumber());
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public InvoiceResponse resolveDispute(Long invoiceId) {
        Invoice inv = findById(invoiceId);
        if (inv.getStatus() != InvoiceStatus.DISPUTED) {
            throw new InvalidStateException("Invoice is not in DISPUTED status");
        }
        inv.setStatus(InvoiceStatus.SENT);
        inv.setDisputeReason(null);
        Invoice saved = invoiceRepo.save(inv);
        auditLogService.log("Invoice", invoiceId, AuditAction.STATE_CHANGE,
                Map.of("status", "DISPUTED"), Map.of("status", "SENT"),
                "Dispute resolved: " + inv.getInvoiceNumber());
        return InvoiceResponse.from(saved);
    }

    @Transactional
    public InvoiceResponse recordPayment(Long invoiceId, RecordPaymentRequest req) {
        Invoice inv = findById(invoiceId);
        if (inv.getStatus() == InvoiceStatus.PAID || inv.getStatus() == InvoiceStatus.CANCELLED) {
            throw new InvalidStateException("Cannot record payment for invoice with status: " + inv.getStatus());
        }

        Payment payment = Payment.builder()
            .invoice(inv)
            .paymentDate(req.paymentDate())
            .amountUsd(req.amountUsd())
            .currency(req.currency())
            .fxRateToUsd(req.fxRateToUsd() != null ? req.fxRateToUsd() : BigDecimal.ONE)
            .paymentReference(req.paymentReference())
            .paymentMethod(req.paymentMethod() != null ? req.paymentMethod() : "SWIFT")
            .recordedAt(Instant.now())
            .build();
        paymentRepo.save(payment);

        BigDecimal totalPaid = paymentRepo.sumPaidAmountByInvoice(invoiceId);
        if (totalPaid.compareTo(inv.getTotalAmountUsd()) >= 0) {
            inv.setStatus(InvoiceStatus.PAID);
            counterpartyService.recalculateExposure(inv.getCounterparty().getId());
            auditLogService.log("Invoice", invoiceId, AuditAction.STATE_CHANGE,
                    Map.of("status", "SENT"), Map.of("status", "PAID", "totalPaid", totalPaid),
                    "Invoice fully paid: " + inv.getInvoiceNumber());
        }
        return InvoiceResponse.from(invoiceRepo.save(inv));
    }

    @Transactional(readOnly = true)
    public InvoiceResponse getById(Long id) {
        return InvoiceResponse.from(findById(id));
    }

    @Transactional(readOnly = true)
    public List<InvoiceResponse> getByStatus(InvoiceStatus status) {
        return invoiceRepo.findByStatus(status).stream().map(InvoiceResponse::from).toList();
    }

    private Invoice findById(Long id) {
        return invoiceRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Invoice", id));
    }

    private String generateInvoiceNumber() {
        String monthStr = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
        long nextNum = invoiceRepo.findMaxId() + 1;
        return String.format("INV-%s-%05d", monthStr, nextNum);
    }
}
