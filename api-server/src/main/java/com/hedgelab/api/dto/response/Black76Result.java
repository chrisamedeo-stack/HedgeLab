package com.hedgelab.api.dto.response;

import java.time.LocalDate;

public record Black76Result(
        double delta,
        double gamma,
        double vega,
        double premium,
        double impliedVolatility,
        double d1,
        double d2,
        LocalDate calculationDate
) {}
