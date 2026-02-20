package com.hedgelab.api.repository;

import com.hedgelab.api.entity.PhysicalContract;
import com.hedgelab.api.entity.PhysicalContractStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

public interface PhysicalContractRepository extends JpaRepository<PhysicalContract, Long> {
    List<PhysicalContract> findBySiteCodeOrderByContractDateDesc(String siteCode);
    List<PhysicalContract> findBySiteCodeAndDeliveryMonthOrderByContractDateDesc(String siteCode, String deliveryMonth);
    List<PhysicalContract> findByDeliveryMonthOrderBySiteCodeAsc(String deliveryMonth);
    List<PhysicalContract> findByStatus(PhysicalContractStatus status);
    List<PhysicalContract> findByStatusNotIn(Collection<PhysicalContractStatus> statuses);
    List<PhysicalContract> findByStatusNotInAndSite_CountryOrderByDeliveryMonth(Collection<PhysicalContractStatus> statuses, String country);
}
