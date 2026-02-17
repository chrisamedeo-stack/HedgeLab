package com.hedgelab.api;

import com.hedgelab.domain.masterdata.HedgeBook;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/hedgebooks")
public class HedgeBookController {

    @GetMapping
    public List<HedgeBook> list() {
        return List.of(
                new HedgeBook(
                        UUID.randomUUID(),
                        "Canada Corn Book",
                        "CAD",
                        List.of("Corn"),
                        new BigDecimal("70")
                )
        );
    }
}
