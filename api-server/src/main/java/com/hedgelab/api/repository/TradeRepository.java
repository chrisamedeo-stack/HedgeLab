package com.hedgelab.api.repository;

import com.hedgelab.api.entity.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TradeRepository extends JpaRepository<Trade, Long>, JpaSpecificationExecutor<Trade> {
    @Query("SELECT COALESCE(MAX(t.id), 0) FROM Trade t")
    long findMaxId();
    Optional<Trade> findByTradeReference(String tradeReference);
    boolean existsByTradeReference(String tradeReference);
    List<Trade> findByCounterpartyAndStatus(Counterparty counterparty, TradeStatus status);
    List<Trade> findByBookAndStatus(Book book, TradeStatus status);
    List<Trade> findByStatus(TradeStatus status);

    @Query("SELECT t FROM Trade t WHERE t.status NOT IN ('CANCELLED','SETTLED') AND t.counterparty.id = :cpId")
    List<Trade> findOpenTradesByCounterparty(@Param("cpId") Long counterpartyId);

    @Query("SELECT t FROM Trade t WHERE t.status NOT IN ('CANCELLED','SETTLED') AND t.endDate >= :asOf")
    List<Trade> findAllOpenAsOf(@Param("asOf") LocalDate asOf);

    @Query("SELECT COUNT(t) FROM Trade t WHERE t.commodity.id = :commodityId AND t.status NOT IN ('CANCELLED','SETTLED')")
    long countOpenTradesByCommodity(@Param("commodityId") Long commodityId);

    @Query("SELECT t FROM Trade t WHERE " +
           "(:from IS NULL OR t.tradeDate >= :from) AND " +
           "(:to IS NULL OR t.tradeDate <= :to) AND " +
           "(:bookId IS NULL OR t.book.id = :bookId) AND " +
           "(:commodityId IS NULL OR t.commodity.id = :commodityId) AND " +
           "(:counterpartyId IS NULL OR t.counterparty.id = :counterpartyId) " +
           "ORDER BY t.tradeDate DESC, t.id DESC")
    List<Trade> findByFilter(
           @Param("from") LocalDate from,
           @Param("to") LocalDate to,
           @Param("bookId") Long bookId,
           @Param("commodityId") Long commodityId,
           @Param("counterpartyId") Long counterpartyId);
}
