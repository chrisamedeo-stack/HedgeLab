package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Invoice;
import com.hedgelab.api.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByInvoice(Invoice invoice);

    @Query("SELECT COALESCE(SUM(p.amountUsd), 0) FROM Payment p WHERE p.invoice.id = :invoiceId")
    BigDecimal sumPaidAmountByInvoice(@Param("invoiceId") Long invoiceId);
}
