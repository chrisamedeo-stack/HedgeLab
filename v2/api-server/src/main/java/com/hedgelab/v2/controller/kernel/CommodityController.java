package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.Commodity;
import com.hedgelab.v2.service.kernel.CommodityService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/kernel/commodities")
@RequiredArgsConstructor
public class CommodityController {

    private final CommodityService commodityService;

    @GetMapping
    public List<Commodity> list() {
        return commodityService.listActive();
    }
}
