package com.hedgelab.api.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Data
public class PublishSettleRequest {
    /** Settle date (defaults to today if omitted) */
    private LocalDate settleDate;
    /** futures month → $/bushel  e.g. { "ZCN26": 4.3875 } */
    private Map<String, BigDecimal> prices;
}
