package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.CounterpartyType;
import com.hedgelab.api.entity.CreditRating;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateCounterpartyRequest(
    @NotBlank @Size(max = 30) String legalEntityCode,
    @NotBlank @Size(max = 50) String shortName,
    @NotBlank @Size(max = 200) String fullLegalName,
    @NotNull CounterpartyType type,
    CreditRating creditRating,
    @PositiveOrZero BigDecimal creditLimitUsd,
    @Size(min = 2, max = 2) String country,
    String legalEntityIdentifier,
    String registrationNumber,
    String contactEmail,
    String contactPhone,
    LocalDate onboardedDate,
    @Size(max = 2000) String internalNotes
) {}
