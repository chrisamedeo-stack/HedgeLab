package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record CounterpartyResponse(
    Long id,
    String legalEntityCode,
    String shortName,
    String fullLegalName,
    CounterpartyType type,
    CounterpartyStatus status,
    CreditRating creditRating,
    BigDecimal creditLimitUsd,
    BigDecimal currentExposureUsd,
    BigDecimal availableCreditUsd,
    String country,
    String contactEmail,
    String contactPhone,
    LocalDate onboardedDate,
    Instant createdAt
) {
    public static CounterpartyResponse from(Counterparty cp) {
        BigDecimal available = cp.getCreditLimitUsd() == null ? BigDecimal.ZERO
            : cp.getCreditLimitUsd().subtract(
                cp.getCurrentExposureUsd() == null ? BigDecimal.ZERO : cp.getCurrentExposureUsd());
        return new CounterpartyResponse(
            cp.getId(), cp.getLegalEntityCode(), cp.getShortName(), cp.getFullLegalName(),
            cp.getType(), cp.getStatus(), cp.getCreditRating(), cp.getCreditLimitUsd(),
            cp.getCurrentExposureUsd(), available, cp.getCountry(),
            cp.getContactEmail(), cp.getContactPhone(), cp.getOnboardedDate(), cp.getCreatedAt()
        );
    }
}
