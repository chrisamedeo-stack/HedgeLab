package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateOffsetRequest {
    private Integer lots;
    private BigDecimal exitPrice;    // $/bu
    private LocalDate offsetDate;
    private String notes;
}
