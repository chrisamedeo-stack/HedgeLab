package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.BatchForecastUpdateRequest;
import com.hedgelab.api.dto.request.SaveBudgetLineRequest;
import com.hedgelab.api.dto.response.CornBudgetLineResponse;
import com.hedgelab.api.dto.response.CornBudgetLineResponse.ForecastHistoryDto;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.CornBudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/{commodity}/budget")
@RequiredArgsConstructor
public class CornBudgetController {

    private final CornBudgetService budgetService;
    private final CommoditySpecService specService;

    @GetMapping
    public List<CornBudgetLineResponse> getAll(
            @PathVariable String commodity,
            @RequestParam(required = false) String site,
            @RequestParam(required = false) String cropYear,
            @RequestParam(required = false) String fiscalYear) {
        String code = specService.resolveSlug(commodity);
        return budgetService.getAll(code, site, cropYear, fiscalYear);
    }

    @GetMapping("/{id}")
    public CornBudgetLineResponse getById(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return budgetService.getById(id);
    }

    @GetMapping("/{id}/forecast-history")
    public List<ForecastHistoryDto> getForecastHistory(@PathVariable String commodity,
                                                        @PathVariable Long id) {
        specService.resolveSlug(commodity);
        return budgetService.getForecastHistory(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CornBudgetLineResponse create(@PathVariable String commodity,
                                          @RequestBody SaveBudgetLineRequest req) {
        String code = specService.resolveSlug(commodity);
        return budgetService.create(code, req);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<CornBudgetLineResponse> bulkCreate(@PathVariable String commodity,
                                                     @RequestBody List<SaveBudgetLineRequest> reqs) {
        String code = specService.resolveSlug(commodity);
        return reqs.stream().map(r -> budgetService.create(code, r)).collect(java.util.stream.Collectors.toList());
    }

    @PostMapping("/forecast-batch")
    public List<CornBudgetLineResponse> batchForecastUpdate(@PathVariable String commodity,
                                                              @RequestBody BatchForecastUpdateRequest req) {
        String code = specService.resolveSlug(commodity);
        return budgetService.batchForecastUpdate(code, req);
    }

    @PutMapping("/{id}")
    public CornBudgetLineResponse update(@PathVariable String commodity,
                                          @PathVariable Long id,
                                          @RequestBody SaveBudgetLineRequest req) {
        specService.resolveSlug(commodity);
        return budgetService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String commodity, @PathVariable Long id) {
        specService.resolveSlug(commodity);
        budgetService.delete(id);
    }
}
