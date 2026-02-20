package com.hedgelab.api.dto.request;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

public record ExportFilter(
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
        Long bookId,
        Long commodityId,
        Long counterpartyId
) {
    public ExportFilter {
        if (from == null) from = LocalDate.now().minusYears(1);
        if (to == null)   to   = LocalDate.now();
    }
}
