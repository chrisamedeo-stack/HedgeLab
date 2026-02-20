package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Counterparty;
import com.hedgelab.api.entity.CreditUtilization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface CreditUtilizationRepository extends JpaRepository<CreditUtilization, Long> {
    Optional<CreditUtilization> findTopByCounterpartyOrderBySnapshotDateDesc(Counterparty counterparty);
    Optional<CreditUtilization> findByCounterpartyAndSnapshotDate(Counterparty counterparty, LocalDate date);

    @Query("SELECT cu FROM CreditUtilization cu WHERE cu.alertLevel IN ('AMBER','RED') " +
           "AND cu.snapshotDate = (SELECT MAX(cu2.snapshotDate) FROM CreditUtilization cu2 WHERE cu2.counterparty = cu.counterparty)")
    List<CreditUtilization> findLatestAlertedUtilizations();
}
