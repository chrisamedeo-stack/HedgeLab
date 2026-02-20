package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Book;
import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.RiskMetric;
import com.hedgelab.api.entity.RiskMetricType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RiskMetricRepository extends JpaRepository<RiskMetric, Long> {
    Optional<RiskMetric> findTopByBookAndCommodityAndMetricTypeOrderByMetricDateDesc(
        Book book, Commodity commodity, RiskMetricType type);
    List<RiskMetric> findByBookAndMetricTypeAndMetricDateBetweenOrderByMetricDateAsc(
        Book book, RiskMetricType type, LocalDate from, LocalDate to);
    List<RiskMetric> findByMetricDate(LocalDate date);
}
