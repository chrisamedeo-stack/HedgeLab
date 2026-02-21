package com.hedgelab.api.repository;

import com.hedgelab.api.entity.EFPTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface EFPTicketRepository extends JpaRepository<EFPTicket, Long> {
    @Query("SELECT COALESCE(MAX(e.id), 0) FROM EFPTicket e")
    long findMaxId();
    List<EFPTicket> findByPhysicalContractIdOrderByEfpDateDesc(Long contractId);
    List<EFPTicket> findByHedgeTradeIdOrderByEfpDateDesc(Long hedgeTradeId);
    List<EFPTicket> findAllByOrderByEfpDateDesc();
}
