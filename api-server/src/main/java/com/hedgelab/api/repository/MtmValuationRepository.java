package com.hedgelab.api.repository;

import com.hedgelab.api.entity.MtmValuation;
import com.hedgelab.api.entity.Trade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MtmValuationRepository extends JpaRepository<MtmValuation, Long> {
    Optional<MtmValuation> findTopByTradeOrderByValuationDateDesc(Trade trade);
    List<MtmValuation> findByTradeAndValuationDateBetweenOrderByValuationDateAsc(Trade trade, LocalDate from, LocalDate to);
    List<MtmValuation> findByValuationDate(LocalDate valuationDate);
    boolean existsByTradeAndValuationDate(Trade trade, LocalDate valuationDate);
}
