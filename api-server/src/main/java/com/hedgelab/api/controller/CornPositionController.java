package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.PublishSettleRequest;
import com.hedgelab.api.dto.response.CornPositionResponse;
import com.hedgelab.api.service.CornPositionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/corn/positions")
@RequiredArgsConstructor
public class CornPositionController {

    private final CornPositionService positionService;

    /** Returns the full three-panel position snapshot. */
    @GetMapping
    public CornPositionResponse getPositions() {
        return positionService.getPositions();
    }

    /** Publishes daily ZC settle prices for MTM calculations. */
    @PostMapping("/settle")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void publishSettle(@RequestBody PublishSettleRequest req) {
        positionService.publishSettle(req);
    }
}
