package com.hedgelab.v2.controller.market;

import com.hedgelab.v2.entity.market.ForwardCurve;
import com.hedgelab.v2.service.market.MarketDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v2/market/curves")
@RequiredArgsConstructor
public class CurveController {

    private final MarketDataService marketDataService;

    @GetMapping
    public List<ForwardCurve> get(@RequestParam String commodityId, @RequestParam String curveDate) {
        return marketDataService.getForwardCurve(commodityId, LocalDate.parse(curveDate));
    }
}
