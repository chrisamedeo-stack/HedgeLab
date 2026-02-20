package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.CommodityCategory;
import com.hedgelab.api.entity.UnitOfMeasure;

import java.time.Instant;

public record CommodityResponse(
    Long id,
    String code,
    String name,
    CommodityCategory category,
    UnitOfMeasure unitOfMeasure,
    String currency,
    boolean hedgeable,
    boolean active,
    String description,
    String icisCode,
    Instant createdAt
) {
    public static CommodityResponse from(Commodity c) {
        return new CommodityResponse(
            c.getId(), c.getCode(), c.getName(), c.getCategory(),
            c.getUnitOfMeasure(), c.getCurrency(), c.isHedgeable(), c.isActive(),
            c.getDescription(), c.getIcisCode(), c.getCreatedAt()
        );
    }
}
