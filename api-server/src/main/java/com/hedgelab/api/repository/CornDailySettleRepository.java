package com.hedgelab.api.repository;

import com.hedgelab.api.entity.CornDailySettle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CornDailySettleRepository extends JpaRepository<CornDailySettle, Long> {
    Optional<CornDailySettle> findTopByFuturesMonthOrderBySettleDateDesc(String futuresMonth);
}
