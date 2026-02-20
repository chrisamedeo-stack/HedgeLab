package com.hedgelab.api.repository;

import com.hedgelab.api.entity.ReceiptTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReceiptTicketRepository extends JpaRepository<ReceiptTicket, Long> {
    List<ReceiptTicket> findBySiteCodeOrderByReceiptDateDesc(String siteCode);
    List<ReceiptTicket> findByPhysicalContractIdOrderByReceiptDateDesc(Long contractId);
    List<ReceiptTicket> findAllByOrderByReceiptDateDesc();
}
