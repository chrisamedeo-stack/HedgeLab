package com.hedgelab.api.repository;

import com.hedgelab.api.entity.CornForecastHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CornForecastHistoryRepository extends JpaRepository<CornForecastHistory, Long> {

    List<CornForecastHistory> findByBudgetLineIdOrderByRecordedAtDesc(Long budgetLineId);
}
