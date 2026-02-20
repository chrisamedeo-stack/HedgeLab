package com.hedgelab.api.repository;

import com.hedgelab.api.entity.SiteBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface SiteBudgetRepository extends JpaRepository<SiteBudget, Long> {
    List<SiteBudget> findBySiteCodeOrderByDeliveryMonth(String siteCode);
    Optional<SiteBudget> findBySiteCodeAndDeliveryMonth(String siteCode, String deliveryMonth);
    List<SiteBudget> findByDeliveryMonth(String deliveryMonth);
}
