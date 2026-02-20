package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateHedgeTradeRequest;
import com.hedgelab.api.dto.response.HedgeTradeResponse;
import com.hedgelab.api.service.HedgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/hedges")
@RequiredArgsConstructor
public class HedgeController {
    private final HedgeService service;

    @GetMapping
    public List<HedgeTradeResponse> getAll(@RequestParam(required = false) String book) {
        if (book != null && !book.isBlank()) {
            return service.getAllHedgesByBook(book);
        }
        return service.getAllHedges();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeTradeResponse create(@RequestBody CreateHedgeTradeRequest req) {
        return service.create(req);
    }
}
