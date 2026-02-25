package com.hedgelab.api.dto.response;

import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class HedgeOffsetResponse {
    private Long id;
    private String tradeRef;
    private String futuresMonth;
    private String siteCode;
    private String siteName;
    private Integer lots;
    private BigDecimal entryPrice;      // $/bu
    private BigDecimal exitPrice;       // $/bu
    private BigDecimal pnlPerBu;       // sell − buy
    private BigDecimal pnlUsd;         // (sell − buy) × lots × 5000
    private LocalDate offsetDate;
    private String notes;
}
