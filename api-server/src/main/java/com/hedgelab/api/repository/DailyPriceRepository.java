package com.hedgelab.api.repository;

import com.hedgelab.api.entity.DailyPrice;
import com.hedgelab.api.entity.PriceIndex;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailyPriceRepository extends JpaRepository<DailyPrice, Long> {
    Optional<DailyPrice> findTopByPriceIndexAndConfirmedTrueOrderByPriceDateDesc(PriceIndex priceIndex);
    Optional<DailyPrice> findByPriceIndexAndPriceDateAndPriceType(PriceIndex priceIndex, LocalDate date, String priceType);
    List<DailyPrice> findByPriceIndexAndPriceDateBetweenOrderByPriceDateAsc(PriceIndex priceIndex, LocalDate from, LocalDate to);
    boolean existsByPriceIndexAndPriceDateAndPriceType(PriceIndex priceIndex, LocalDate date, String priceType);
}
