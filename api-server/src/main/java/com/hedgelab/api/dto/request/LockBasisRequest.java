package com.hedgelab.api.dto.request;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LockBasisRequest {
    private BigDecimal basisCentsBu; // ¢/bu
    private String futuresRef;       // e.g. ZCN26
    private LocalDate lockedDate;    // defaults to today if null
    private String notes;
}
