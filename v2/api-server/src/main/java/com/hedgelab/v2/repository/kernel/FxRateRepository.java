package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.FxRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface FxRateRepository extends JpaRepository<FxRate, Long> {

    @Query("SELECT f FROM FxRate f WHERE f.fromCurrency = :from AND f.toCurrency = :to AND f.rateDate <= :date ORDER BY f.rateDate DESC LIMIT 1")
    Optional<FxRate> findLatestRate(@Param("from") String from, @Param("to") String to, @Param("date") LocalDate date);

    @Query("SELECT f FROM FxRate f WHERE f.fromCurrency = :from AND f.toCurrency = :to ORDER BY f.rateDate DESC LIMIT 1")
    Optional<FxRate> findLatestRate(@Param("from") String from, @Param("to") String to);

    Optional<FxRate> findByFromCurrencyAndToCurrencyAndRateDate(String from, String to, LocalDate date);

    List<FxRate> findAllByOrderByRateDateDesc();
}
