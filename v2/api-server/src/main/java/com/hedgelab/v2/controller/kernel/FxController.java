package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.FxRate;
import com.hedgelab.v2.service.kernel.FxService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v2/kernel/fx")
@RequiredArgsConstructor
public class FxController {

    private final FxService fxService;

    @GetMapping
    public Object get(
            @RequestParam(required = false) BigDecimal amount,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String date) {
        if (amount != null && from != null && to != null) {
            LocalDate d = date != null ? LocalDate.parse(date) : null;
            return fxService.convert(amount, from, to, d);
        }
        return fxService.listAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FxRate upsert(@RequestBody Map<String, Object> body) {
        String from = (String) body.get("fromCurrency");
        String to = (String) body.get("toCurrency");
        LocalDate date = LocalDate.parse((String) body.get("rateDate"));
        BigDecimal rate = new BigDecimal(body.get("rate").toString());
        String source = (String) body.get("source");
        return fxService.upsert(from, to, date, rate, source);
    }
}
