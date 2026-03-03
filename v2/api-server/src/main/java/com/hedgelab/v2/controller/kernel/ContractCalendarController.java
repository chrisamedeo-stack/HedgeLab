package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.ContractCalendar;
import com.hedgelab.v2.service.kernel.ContractCalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/kernel/contract-calendar")
@RequiredArgsConstructor
public class ContractCalendarController {

    private final ContractCalendarService contractCalendarService;

    @GetMapping
    public List<ContractCalendar> list(
            @RequestParam String commodityId,
            @RequestParam(defaultValue = "true") boolean activeOnly) {
        return contractCalendarService.list(commodityId, activeOnly);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContractCalendar upsert(@RequestBody ContractCalendar cal) {
        return contractCalendarService.upsert(cal);
    }
}
