package com.hedgelab.api.repository;

import com.hedgelab.api.entity.ForwardCurvePoint;
import com.hedgelab.api.entity.PriceIndex;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

public interface ForwardCurvePointRepository extends JpaRepository<ForwardCurvePoint, Long> {
    List<ForwardCurvePoint> findByPriceIndexAndCurveDateOrderByDeliveryMonthAsc(PriceIndex priceIndex, LocalDate curveDate);
    Optional<ForwardCurvePoint> findByPriceIndexAndCurveDateAndDeliveryMonth(PriceIndex priceIndex, LocalDate curveDate, YearMonth deliveryMonth);
    Optional<ForwardCurvePoint> findTopByPriceIndexAndDeliveryMonthOrderByCurveDateDesc(PriceIndex priceIndex, YearMonth deliveryMonth);
}
