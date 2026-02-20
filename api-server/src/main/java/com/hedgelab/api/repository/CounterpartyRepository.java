package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Counterparty;
import com.hedgelab.api.entity.CounterpartyStatus;
import com.hedgelab.api.entity.CounterpartyType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CounterpartyRepository extends JpaRepository<Counterparty, Long>, JpaSpecificationExecutor<Counterparty> {
    Optional<Counterparty> findByLegalEntityCode(String code);
    boolean existsByLegalEntityCode(String code);
    boolean existsByShortName(String shortName);
    List<Counterparty> findByStatus(CounterpartyStatus status);
    List<Counterparty> findByStatusAndType(CounterpartyStatus status, CounterpartyType type);

    @Query("SELECT c FROM Counterparty c WHERE c.status = 'ACTIVE' ORDER BY c.shortName")
    List<Counterparty> findAllActive();
}
