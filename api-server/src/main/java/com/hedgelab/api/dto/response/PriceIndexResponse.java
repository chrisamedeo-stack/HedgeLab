package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.PriceIndex;
import com.hedgelab.api.entity.UnitOfMeasure;

public record PriceIndexResponse(
    Long id,
    String indexCode,
    String displayName,
    Long commodityId,
    String commodityCode,
    String provider,
    String currency,
    UnitOfMeasure unit,
    boolean active,
    String description
) {
    public static PriceIndexResponse from(PriceIndex pi) {
        return new PriceIndexResponse(
            pi.getId(), pi.getIndexCode(), pi.getDisplayName(),
            pi.getCommodity().getId(), pi.getCommodity().getCode(),
            pi.getProvider(), pi.getCurrency(), pi.getUnit(), pi.isActive(), pi.getDescription()
        );
    }
}
