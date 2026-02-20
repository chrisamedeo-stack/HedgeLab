package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateReceiptRequest;
import com.hedgelab.api.dto.response.ReceiptResponse;
import com.hedgelab.api.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/corn/receipts")
@RequiredArgsConstructor
public class ReceiptController {
    private final ReceiptService service;

    @GetMapping
    public List<ReceiptResponse> getAll(@RequestParam(required = false) String site) {
        return site != null ? service.getBySite(site) : service.getAllReceipts();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReceiptResponse create(@RequestBody CreateReceiptRequest req) {
        return service.create(req);
    }
}
