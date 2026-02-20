package com.hedgelab.api.repository;

import com.hedgelab.api.entity.Book;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookRepository extends JpaRepository<Book, Long> {
    Optional<Book> findByBookCode(String bookCode);
    boolean existsByBookCode(String bookCode);
    List<Book> findByActive(boolean active);
    List<Book> findByTradingDesk(String tradingDesk);
}
