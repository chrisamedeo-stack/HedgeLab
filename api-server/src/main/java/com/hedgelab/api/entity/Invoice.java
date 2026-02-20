package com.hedgelab.api.entity;

import com.hedgelab.api.converter.YearMonthConverter;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "invoices", uniqueConstraints = @UniqueConstraint(name = "uq_invoice_num", columnNames = "invoice_number"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice extends AuditableEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "invoice_seq")
    @SequenceGenerator(name = "invoice_seq", sequenceName = "invoice_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "invoice_number", length = 30, nullable = false)
    private String invoiceNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "trade_id", nullable = false)
    private Trade trade;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "counterparty_id", nullable = false)
    private Counterparty counterparty;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 15, nullable = false)
    @Builder.Default
    private InvoiceStatus status = InvoiceStatus.DRAFT;

    @Column(name = "invoice_date", nullable = false)
    private LocalDate invoiceDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Convert(converter = YearMonthConverter.class)
    @Column(name = "delivery_month", length = 7)
    private YearMonth deliveryMonth;

    @Column(name = "invoiced_quantity", precision = 20, scale = 6, nullable = false)
    private BigDecimal invoicedQuantity;

    @Column(name = "unit_price", precision = 20, scale = 6, nullable = false)
    private BigDecimal unitPrice;

    @Column(name = "subtotal_usd", precision = 24, scale = 2)
    private BigDecimal subtotalUsd;

    @Column(name = "tax_amount_usd", precision = 24, scale = 2)
    @Builder.Default
    private BigDecimal taxAmountUsd = BigDecimal.ZERO;

    @Column(name = "total_amount_usd", precision = 24, scale = 2, nullable = false)
    private BigDecimal totalAmountUsd;

    @Column(name = "currency", length = 3, nullable = false)
    private String currency;

    @Column(name = "payment_terms", length = 30)
    @Builder.Default
    private String paymentTerms = "NET30";

    @Column(name = "dispute_reason", length = 500)
    private String disputeReason;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @Builder.Default
    private List<Payment> payments = new ArrayList<>();
}
