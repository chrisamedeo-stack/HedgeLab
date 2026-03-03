package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.CreateHedgeTradeRequest;
import com.hedgelab.api.dto.response.HedgeTradeResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.HedgeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/hedges")
@RequiredArgsConstructor
public class HedgeController {
    private final HedgeService service;
    private final CommoditySpecService specService;

    @GetMapping
    public List<HedgeTradeResponse> getAll(@PathVariable String commodity,
                                            @RequestParam(required = false) String book) {
        String code = specService.resolveSlug(commodity);
        if (book != null && !book.isBlank()) {
            return service.getAllHedgesByBook(code, book);
        }
        return service.getAllHedges(code);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HedgeTradeResponse create(@PathVariable String commodity,
                                      @RequestBody CreateHedgeTradeRequest req) {
        specService.resolveSlug(commodity);
        return service.create(req);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<HedgeTradeResponse> createBulk(@PathVariable String commodity,
                                                @RequestBody List<CreateHedgeTradeRequest> requests) {
        specService.resolveSlug(commodity);
        return service.createBulk(requests);
    }

    @PutMapping("/{id}")
    public HedgeTradeResponse update(@PathVariable String commodity,
                                      @PathVariable Long id,
                                      @RequestBody CreateHedgeTradeRequest req) {
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
