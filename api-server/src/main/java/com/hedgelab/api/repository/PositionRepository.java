package com.hedgelab.api.repository;

import com.hedgelab.api.entity.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.YearMonth;
import java.util.List;
import java.util.Optional;

public interface PositionRepository extends JpaRepository<Position, Long> {

    Optional<Position> findByBookAndCommodityAndDeliveryMonthAndPositionType(
        Book book, Commodity commodity, YearMonth deliveryMonth, PositionType positionType);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM Position p WHERE p.book = :book AND p.commodity = :commodity " +
           "AND p.deliveryMonth = :month AND p.positionType = :type")
    Optional<Position> findForUpdate(
        @Param("book") Book book,
        @Param("commodity") Commodity commodity,
        @Param("month") YearMonth month,
        @Param("type") PositionType type);

    List<Position> findByBookAndDeliveryMonthBetweenOrderByDeliveryMonthAsc(
        Book book, YearMonth from, YearMonth to);

    @Query("SELECT p FROM Position p WHERE p.commodity = :commodity AND p.deliveryMonth = :month")
    List<Position> findByCommodityAndDeliveryMonth(
        @Param("commodity") Commodity commodity, @Param("month") YearMonth month);

    List<Position> findByBook(Book book);
}
