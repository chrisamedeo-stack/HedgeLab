package com.hedgelab.api.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateBookRequest(
    @NotBlank @Size(max = 20) String bookCode,
    @NotBlank @Size(max = 100) String displayName,
    @Size(max = 50) String tradingDesk,
    @Size(max = 500) String description
) {}
