package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.PositionResponse;
import com.hedgelab.api.service.PositionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.YearMonth;
import java.util.List;

@RestController
@RequestMapping("/api/v1/positions")
@RequiredArgsConstructor
@Tag(name = "Positions", description = "Position management and net exposure queries")
public class PositionController {

    private final PositionService positionService;

    @GetMapping("/by-book/{bookId}")
    @Operation(summary = "Get all positions for a book, with optional delivery month range")
    public List<PositionResponse> getByBook(
            @PathVariable Long bookId,
            @RequestParam(required = false) String fromMonth,
            @RequestParam(required = false) String toMonth) {
        YearMonth from = fromMonth != null ? YearMonth.parse(fromMonth) : YearMonth.now().minusMonths(6);
        YearMonth to = toMonth != null ? YearMonth.parse(toMonth) : YearMonth.now().plusMonths(12);
        return positionService.getPositionsByBook(bookId, from, to);
    }

    @GetMapping
    @Operation(summary = "Get all positions for a book (all months)")
    public List<PositionResponse> getAllForBook(@RequestParam Long bookId) {
        return positionService.getBookPositions(bookId);
    }

    @GetMapping("/net")
    @Operation(summary = "Get net positions by commodity for a delivery month")
    public List<PositionResponse> getNetPositions(
            @RequestParam Long commodityId,
            @RequestParam(required = false) String deliveryMonth) {
        YearMonth month = deliveryMonth != null ? YearMonth.parse(deliveryMonth) : YearMonth.now();
        return positionService.getNetPositionsByCommodity(commodityId, month);
    }
}
