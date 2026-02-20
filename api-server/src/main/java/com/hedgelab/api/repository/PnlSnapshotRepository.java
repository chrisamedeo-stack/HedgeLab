package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Book;
import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.PnlSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface PnlSnapshotRepository extends JpaRepository<PnlSnapshot, Long> {
    Optional<PnlSnapshot> findByBookAndCommodityAndSnapshotDate(Book book, Commodity commodity, LocalDate date);
    List<PnlSnapshot> findByBookAndSnapshotDateOrderByCommodityAsc(Book book, LocalDate date);
    Optional<PnlSnapshot> findTopByBookAndCommodityOrderBySnapshotDateDesc(Book book, Commodity commodity);
}
