package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.Invoice;
import com.hedgelab.api.entity.InvoiceStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;

public record InvoiceResponse(
    Long id,
    String invoiceNumber,
    Long tradeId,
    String tradeReference,
    Long counterpartyId,
    String counterpartyName,
    InvoiceStatus status,
    LocalDate invoiceDate,
    LocalDate dueDate,
    YearMonth deliveryMonth,
    BigDecimal invoicedQuantity,
    BigDecimal unitPrice,
    BigDecimal subtotalUsd,
    BigDecimal taxAmountUsd,
    BigDecimal totalAmountUsd,
    String currency,
    String paymentTerms,
    String disputeReason
) {
    public static InvoiceResponse from(Invoice inv) {
        return new InvoiceResponse(
            inv.getId(), inv.getInvoiceNumber(),
            inv.getTrade().getId(), inv.getTrade().getTradeReference(),
            inv.getCounterparty().getId(), inv.getCounterparty().getShortName(),
            inv.getStatus(), inv.getInvoiceDate(), inv.getDueDate(),
            inv.getDeliveryMonth(), inv.getInvoicedQuantity(), inv.getUnitPrice(),
            inv.getSubtotalUsd(), inv.getTaxAmountUsd(), inv.getTotalAmountUsd(),
            inv.getCurrency(), inv.getPaymentTerms(), inv.getDisputeReason()
        );
    }
}
