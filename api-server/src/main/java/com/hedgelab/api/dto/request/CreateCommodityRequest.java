package com.hedgelab.api.dto.request;

import com.hedgelab.api.entity.CommodityCategory;
import com.hedgelab.api.entity.UnitOfMeasure;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCommodityRequest(
    @NotBlank @Size(max = 30) String code,
    @NotBlank @Size(max = 100) String name,
    @NotNull CommodityCategory category,
    @NotNull UnitOfMeasure unitOfMeasure,
    @NotBlank @Size(min = 3, max = 3) String currency,
    boolean hedgeable,
    @Size(max = 500) String description,
    @Size(max = 30) String icisCode
) {}
