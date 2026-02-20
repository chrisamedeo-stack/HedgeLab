package com.hedgelab.api.repository;

import com.hedgelab.api.entity.CornBudgetLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CornBudgetLineRepository extends JpaRepository<CornBudgetLine, Long> {
    List<CornBudgetLine> findBySiteCodeOrderByBudgetMonthAsc(String siteCode);
    List<CornBudgetLine> findByCropYearOrderBySiteCodeAscBudgetMonthAsc(String cropYear);
    List<CornBudgetLine> findBySiteCodeAndCropYearOrderByBudgetMonthAsc(String siteCode, String cropYear);
    List<CornBudgetLine> findAllByOrderBySiteCodeAscBudgetMonthAsc();
}
