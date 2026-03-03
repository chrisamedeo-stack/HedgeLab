package com.hedgelab.v2.repository.market;

import com.hedgelab.v2.entity.market.ForwardCurve;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ForwardCurveRepository extends JpaRepository<ForwardCurve, Long> {
    List<ForwardCurve> findByCommodityIdAndCurveDateOrderByContractMonth(String commodityId, LocalDate curveDate);
}
