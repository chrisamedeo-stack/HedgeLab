package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class EFPTicketResponse {
    private Long id;
    private String ticketRef;
    private String hedgeTradeRef;
    private String contractRef;
    private String siteName;
    private String supplierName;
    private Integer lots;
    private String futuresMonth;
    private BigDecimal boardPrice;
    private BigDecimal basisValue;
    private BigDecimal quantityMt;
    private LocalDate efpDate;
    private String confirmationRef;
    private String status;
    private String notes;
}
