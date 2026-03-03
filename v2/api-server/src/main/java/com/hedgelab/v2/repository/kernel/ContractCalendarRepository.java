package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.ContractCalendar;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContractCalendarRepository extends JpaRepository<ContractCalendar, Long> {
    List<ContractCalendar> findByCommodityIdOrderByContractMonth(String commodityId);
    List<ContractCalendar> findByCommodityIdAndIsActiveTrueOrderByContractMonth(String commodityId);
    Optional<ContractCalendar> findByCommodityIdAndContractMonth(String commodityId, String contractMonth);
}
