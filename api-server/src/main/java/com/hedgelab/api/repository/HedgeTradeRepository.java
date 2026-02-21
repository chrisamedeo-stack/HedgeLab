package com.hedgelab.api.repository;

import com.hedgelab.api.entity.HedgeTrade;
import com.hedgelab.api.entity.HedgeTradeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Collection;
import java.util.List;

public interface HedgeTradeRepository extends JpaRepository<HedgeTrade, Long> {
    List<HedgeTrade> findByStatusOrderByTradeDateDesc(HedgeTradeStatus status);
    List<HedgeTrade> findAllByOrderByTradeDateDesc();
    List<HedgeTrade> findByFuturesMonth(String futuresMonth);
    List<HedgeTrade> findByStatusInOrderByTradeDateDesc(Collection<HedgeTradeStatus> statuses);
    List<HedgeTrade> findByStatusInAndBookOrderByTradeDateDesc(Collection<HedgeTradeStatus> statuses, String book);

    @Query("SELECT COALESCE(MAX(h.id), 0) FROM HedgeTrade h")
    long findMaxId();
}
