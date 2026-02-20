package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.UnitOfMeasure;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePriceIndexRequest(
    @NotBlank @Size(max = 50) String indexCode,
    @NotBlank @Size(max = 100) String displayName,
    @NotNull Long commodityId,
    String provider,
    @NotBlank @Size(min = 3, max = 3) String currency,
    UnitOfMeasure unit,
    @Size(max = 500) String description
) {}
