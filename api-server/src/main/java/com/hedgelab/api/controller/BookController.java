package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateBookRequest;
import com.hedgelab.api.dto.response.BookResponse;
import com.hedgelab.api.service.BookService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/books")
@RequiredArgsConstructor
@Tag(name = "Books", description = "Trading book management")
public class BookController {

    private final BookService bookService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new trading book")
    public BookResponse create(@Valid @RequestBody CreateBookRequest req) {
        return bookService.create(req);
    }

    @GetMapping
    @Operation(summary = "List all active trading books")
    public List<BookResponse> getAll() {
        return bookService.getAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get trading book by ID")
    public BookResponse getById(@PathVariable Long id) {
        return bookService.getById(id);
    }
}
