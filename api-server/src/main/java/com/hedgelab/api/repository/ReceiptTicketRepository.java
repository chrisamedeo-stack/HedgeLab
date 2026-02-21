package com.hedgelab.api.repository;

import com.hedgelab.api.entity.ReceiptTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ReceiptTicketRepository extends JpaRepository<ReceiptTicket, Long> {
    @Query("SELECT COALESCE(MAX(r.id), 0) FROM ReceiptTicket r")
    long findMaxId();
    List<ReceiptTicket> findBySiteCodeOrderByReceiptDateDesc(String siteCode);
    List<ReceiptTicket> findByPhysicalContractIdOrderByReceiptDateDesc(Long contractId);
    List<ReceiptTicket> findAllByOrderByReceiptDateDesc();
}
