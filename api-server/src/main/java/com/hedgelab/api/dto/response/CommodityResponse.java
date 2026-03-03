package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.Commodity;
import com.hedgelab.api.entity.CommodityCategory;
import com.hedgelab.api.entity.UnitOfMeasure;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

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
    String exchange,
    String futuresPrefix,
    Integer contractSizeBu,
    BigDecimal bushelsPerMt,
    List<String> contractMonths,
    Map<String, List<Integer>> monthMappings,
    String slug,
    Instant createdAt
) {
    public static CommodityResponse from(Commodity c) {
        return new CommodityResponse(
            c.getId(), c.getCode(), c.getName(), c.getCategory(),
            c.getUnitOfMeasure(), c.getCurrency(), c.isHedgeable(), c.isActive(),
            c.getDescription(), c.getIcisCode(),
            c.getExchange(), c.getFuturesPrefix(), c.getContractSizeBu(),
            c.getBushelsPerMt(), c.getContractMonths(), c.getMonthMappings(),
            c.getSlug(), c.getCreatedAt()
        );
    }
}
