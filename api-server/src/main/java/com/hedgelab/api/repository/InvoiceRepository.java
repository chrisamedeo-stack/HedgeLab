package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Counterparty;
import com.hedgelab.api.entity.Invoice;
import com.hedgelab.api.entity.InvoiceStatus;
import com.hedgelab.api.entity.Trade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long>, JpaSpecificationExecutor<Invoice> {
    @Query("SELECT COALESCE(MAX(i.id), 0) FROM Invoice i")
    long findMaxId();
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    List<Invoice> findByCounterpartyAndStatus(Counterparty counterparty, InvoiceStatus status);
    List<Invoice> findByTradeAndStatus(Trade trade, InvoiceStatus status);
    List<Invoice> findByStatus(InvoiceStatus status);

    @Query("SELECT COALESCE(SUM(i.totalAmountUsd), 0) FROM Invoice i " +
           "WHERE i.counterparty.id = :cpId AND i.status NOT IN ('PAID','CANCELLED')")
    BigDecimal sumUnpaidAmountByCounterparty(@Param("cpId") Long counterpartyId);
}
