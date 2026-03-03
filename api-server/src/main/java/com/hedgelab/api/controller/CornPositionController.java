package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.PublishSettleRequest;
import com.hedgelab.api.dto.response.CornPositionResponse;
import com.hedgelab.api.service.CommoditySpecService;
import com.hedgelab.api.service.CornPositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/{commodity}/positions")
@RequiredArgsConstructor
public class CornPositionController {

    private final CornPositionService positionService;
    private final CommoditySpecService specService;

    @GetMapping
    public CornPositionResponse getPositions(@PathVariable String commodity,
                                              @RequestParam(required = false) String book) {
        String code = specService.resolveSlug(commodity);
        return positionService.getPositions(code, book);
    }

    @PostMapping("/settle")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void publishSettle(@PathVariable String commodity,
                               @RequestBody PublishSettleRequest req) {
        specService.resolveSlug(commodity);
        positionService.publishSettle(req);
    }

    @PostMapping("/refresh-prices")
    public Map<String, Object> refreshPrices(@PathVariable String commodity) {
        String code = specService.resolveSlug(commodity);
        return positionService.refreshPrices(code);
    }
}
