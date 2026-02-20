package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.CreditUtilization;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreditUtilizationResponse(
    Long counterpartyId,
    String counterpartyCode,
    String counterpartyName,
    LocalDate snapshotDate,
    BigDecimal approvedLimitUsd,
    BigDecimal currentExposureUsd,
    BigDecimal utilizationPct,
    String alertLevel
) {
    public static CreditUtilizationResponse from(CreditUtilization cu) {
        return new CreditUtilizationResponse(
            cu.getCounterparty().getId(), cu.getCounterparty().getLegalEntityCode(),
            cu.getCounterparty().getShortName(), cu.getSnapshotDate(),
            cu.getApprovedLimitUsd(), cu.getCurrentExposureUsd(),
            cu.getUtilizationPct(), cu.getAlertLevel()
        );
    }
}
