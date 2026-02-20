package com.hedgelab.api.repository;

import com.hedgelab.api.entity.DeliverySchedule;
import com.hedgelab.api.entity.DeliveryStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DeliveryScheduleRepository extends JpaRepository<DeliverySchedule, Long> {
    List<DeliverySchedule> findByTradeIdOrderByDeliveryMonthAsc(Long tradeId);
    List<DeliverySchedule> findByTradeIdAndStatus(Long tradeId, DeliveryStatus status);
}
