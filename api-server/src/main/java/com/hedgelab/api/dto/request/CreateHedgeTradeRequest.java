package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateHedgeTradeRequest {
    private String futuresMonth; // e.g. ZCH25
    private Integer lots;
    private BigDecimal pricePerBushel;
    private String brokerAccount;
    private LocalDate tradeDate;
    private String notes;
    private String book; // "CANADA" or "US" — defaults to "CANADA"
}
