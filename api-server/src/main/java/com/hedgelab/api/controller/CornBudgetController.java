package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.BatchForecastUpdateRequest;
import com.hedgelab.api.dto.request.SaveBudgetLineRequest;
import com.hedgelab.api.dto.response.CornBudgetLineResponse;
import com.hedgelab.api.dto.response.CornBudgetLineResponse.ForecastHistoryDto;
import com.hedgelab.api.service.CornBudgetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/corn/budget")
@RequiredArgsConstructor
public class CornBudgetController {

    private final CornBudgetService budgetService;

    @GetMapping
    public List<CornBudgetLineResponse> getAll(
            @RequestParam(required = false) String site,
            @RequestParam(required = false) String cropYear,
            @RequestParam(required = false) String fiscalYear) {
        return budgetService.getAll(site, cropYear, fiscalYear);
    }

    @GetMapping("/{id}")
    public CornBudgetLineResponse getById(@PathVariable Long id) {
        return budgetService.getById(id);
    }

    @GetMapping("/{id}/forecast-history")
    public List<ForecastHistoryDto> getForecastHistory(@PathVariable Long id) {
        return budgetService.getForecastHistory(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CornBudgetLineResponse create(@RequestBody SaveBudgetLineRequest req) {
        return budgetService.create(req);
    }

    @PostMapping("/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<CornBudgetLineResponse> bulkCreate(@RequestBody List<SaveBudgetLineRequest> reqs) {
        return reqs.stream().map(budgetService::create).collect(Collectors.toList());
    }

    @PostMapping("/forecast-batch")
    public List<CornBudgetLineResponse> batchForecastUpdate(@RequestBody BatchForecastUpdateRequest req) {
        return budgetService.batchForecastUpdate(req);
    }

    @PutMapping("/{id}")
    public CornBudgetLineResponse update(@PathVariable Long id, @RequestBody SaveBudgetLineRequest req) {
        return budgetService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        budgetService.delete(id);
    }
}
