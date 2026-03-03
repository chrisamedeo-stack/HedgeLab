package com.hedgelab.v2.repository.market;

import com.hedgelab.v2.entity.market.MarketPrice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MarketPriceRepository extends JpaRepository<MarketPrice, Long> {

    Optional<MarketPrice> findByCommodityIdAndContractMonthAndPriceDateAndPriceType(
            String commodityId, String contractMonth, LocalDate priceDate, String priceType);

    @Query("SELECT p FROM MarketPrice p WHERE p.commodityId = :commodityId AND p.contractMonth = :contractMonth" +
           " AND p.priceType = 'settlement' ORDER BY p.priceDate DESC LIMIT 1")
    Optional<MarketPrice> findLatestPrice(@Param("commodityId") String commodityId,
                                           @Param("contractMonth") String contractMonth);

    @Query(value = "SELECT DISTINCT ON (contract_month) * FROM md_prices" +
           " WHERE commodity_id = :commodityId AND price_type = 'settlement'" +
           " ORDER BY contract_month, price_date DESC", nativeQuery = true)
    List<MarketPrice> findLatestPricesByMonth(@Param("commodityId") String commodityId);

    @Query("SELECT p FROM MarketPrice p WHERE 1=1" +
           " AND (:commodityId IS NULL OR p.commodityId = :commodityId)" +
           " AND (:contractMonth IS NULL OR p.contractMonth = :contractMonth)" +
           " AND (:dateFrom IS NULL OR p.priceDate >= :dateFrom)" +
           " AND (:dateTo IS NULL OR p.priceDate <= :dateTo)" +
           " AND (:priceType IS NULL OR p.priceType = :priceType)" +
           " ORDER BY p.priceDate DESC, p.contractMonth")
    List<MarketPrice> findFiltered(@Param("commodityId") String commodityId,
                                    @Param("contractMonth") String contractMonth,
                                    @Param("dateFrom") LocalDate dateFrom,
                                    @Param("dateTo") LocalDate dateTo,
                                    @Param("priceType") String priceType);
}
