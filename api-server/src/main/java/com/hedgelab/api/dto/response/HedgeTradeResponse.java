package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class HedgeTradeResponse {
    private Long id;
    private String tradeRef;
    private String futuresMonth;
    private Integer lots;
    private Integer openLots;
    private int allocatedLots;
    private int unallocatedLots;
    private BigDecimal pricePerBushel;
    private String brokerAccount;
    private LocalDate tradeDate;
    private String status;
    private BigDecimal equivalentMt; // lots * 5000 / 39.3683
    private String book; // CANADA or US
    private String notes;
}
