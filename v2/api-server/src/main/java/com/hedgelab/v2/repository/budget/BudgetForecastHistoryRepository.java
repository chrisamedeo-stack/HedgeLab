package com.hedgelab.v2.repository.budget;

import com.hedgelab.v2.entity.budget.BudgetForecastHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BudgetForecastHistoryRepository extends JpaRepository<BudgetForecastHistory, UUID> {

    List<BudgetForecastHistory> findByLineItemIdOrderByRecordedAtDesc(UUID lineItemId);
}
