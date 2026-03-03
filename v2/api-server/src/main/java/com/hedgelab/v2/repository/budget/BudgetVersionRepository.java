package com.hedgelab.v2.repository.budget;

import com.hedgelab.v2.entity.budget.BudgetVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BudgetVersionRepository extends JpaRepository<BudgetVersion, UUID> {

    List<BudgetVersion> findByPeriodIdOrderByVersionNumberDesc(UUID periodId);

    @Query("SELECT COALESCE(MAX(v.versionNumber), 0) FROM BudgetVersion v WHERE v.periodId = :periodId")
    int findMaxVersionNumber(@Param("periodId") UUID periodId);

    Optional<BudgetVersion> findByPeriodIdAndVersionNumber(UUID periodId, int versionNumber);
}
