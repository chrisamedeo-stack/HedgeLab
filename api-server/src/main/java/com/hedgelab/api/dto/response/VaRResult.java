package com.hedgelab.api.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;

public record VaRResult(
        BigDecimal var1d95,
        BigDecimal var1d99,
        BigDecimal var10d95,
        BigDecimal var10d99,
        int observationCount,
        int lookbackDays,
        LocalDate calculationDate
) {}
