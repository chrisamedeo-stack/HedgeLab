package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.CreateBookRequest;
import com.hedgelab.api.dto.response.BookResponse;
import com.hedgelab.api.entity.Book;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.BookRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BookService {

    private final BookRepository bookRepo;

    @Transactional
    public BookResponse create(CreateBookRequest req) {
        if (bookRepo.existsByBookCode(req.bookCode())) {
            throw new InvalidStateException("Book code already exists: " + req.bookCode());
        }
        Book b = Book.builder()
            .bookCode(req.bookCode().toUpperCase())
            .displayName(req.displayName())
            .tradingDesk(req.tradingDesk())
            .description(req.description())
            .build();
        return BookResponse.from(bookRepo.save(b));
    }

    @Transactional(readOnly = true)
    public List<BookResponse> getAll() {
        return bookRepo.findByActive(true).stream().map(BookResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public BookResponse getById(Long id) {
        return BookResponse.from(findById(id));
    }

    public Book findById(Long id) {
        return bookRepo.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Book", id));
    }
}
