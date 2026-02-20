package com.hedgelab.api.repository;

import com.hedgelab.api.entity.HedgeTrade;
import com.hedgelab.api.entity.HedgeTradeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface HedgeTradeRepository extends JpaRepository<HedgeTrade, Long> {
    List<HedgeTrade> findByStatusOrderByTradeDateDesc(HedgeTradeStatus status);
    List<HedgeTrade> findAllByOrderByTradeDateDesc();
    List<HedgeTrade> findByFuturesMonth(String futuresMonth);
    List<HedgeTrade> findByStatusInOrderByTradeDateDesc(Collection<HedgeTradeStatus> statuses);
}
