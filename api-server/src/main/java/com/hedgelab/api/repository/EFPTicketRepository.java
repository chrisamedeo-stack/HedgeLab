package com.hedgelab.api.repository;

import com.hedgelab.api.entity.EFPTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EFPTicketRepository extends JpaRepository<EFPTicket, Long> {
    List<EFPTicket> findByPhysicalContractIdOrderByEfpDateDesc(Long contractId);
    List<EFPTicket> findByHedgeTradeIdOrderByEfpDateDesc(Long hedgeTradeId);
    List<EFPTicket> findAllByOrderByEfpDateDesc();
}
