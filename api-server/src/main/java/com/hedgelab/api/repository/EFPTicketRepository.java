package com.hedgelab.api.repository;

import com.hedgelab.api.entity.EFPTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface EFPTicketRepository extends JpaRepository<EFPTicket, Long> {
    @Query("SELECT COALESCE(MAX(e.id), 0) FROM EFPTicket e")
    long findMaxId();
    List<EFPTicket> findByPhysicalContractIdOrderByEfpDateDesc(Long contractId);
    List<EFPTicket> findByHedgeTradeIdOrderByEfpDateDesc(Long hedgeTradeId);
    List<EFPTicket> findAllByOrderByEfpDateDesc();

    @Query("SELECT COALESCE(SUM(e.lots), 0) FROM EFPTicket e WHERE e.hedgeTrade.id = :tradeId")
    int sumLotsByHedgeTradeId(@Param("tradeId") Long tradeId);
}
