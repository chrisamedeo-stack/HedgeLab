package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateReceiptRequest;
import com.hedgelab.api.dto.response.ReceiptResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.ReceiptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/receipts")
@RequiredArgsConstructor
public class ReceiptController {
    private final ReceiptService service;
    private final CommoditySpecService specService;

    @GetMapping
    public List<ReceiptResponse> getAll(@PathVariable String commodity,
                                         @RequestParam(required = false) String site) {
        String code = specService.resolveSlug(commodity);
        return site != null ? service.getBySite(code, site) : service.getAllReceipts(code);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReceiptResponse create(@PathVariable String commodity,
                                   @RequestBody CreateReceiptRequest req) {
        specService.resolveSlug(commodity);
        return service.create(req);
    }

    @PutMapping("/{id}")
    public ReceiptResponse update(@PathVariable String commodity,
                                   @PathVariable Long id,
                                   @RequestBody CreateReceiptRequest req) {
        specService.resolveSlug(commodity);
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        service.delete(id);
    }
}
