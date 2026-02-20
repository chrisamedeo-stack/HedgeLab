package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateEFPRequest {
    private Long hedgeTradeId;
    private Long physicalContractId;
    private Integer lots;
    private BigDecimal boardPrice;
    private BigDecimal basisValue;
    private LocalDate efpDate;
    private String confirmationRef;
    private String notes;
}
