package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.DeliverySchedule;
import com.hedgelab.api.entity.DeliveryStatus;

import java.math.BigDecimal;
import java.time.YearMonth;

public record DeliveryScheduleResponse(
        Long id,
        Long tradeId,
        YearMonth deliveryMonth,
        BigDecimal scheduledQuantity,
        BigDecimal deliveredQuantity,
        DeliveryStatus status,
        String deliveryLocation,
        String nominationRef
) {
    public static DeliveryScheduleResponse from(DeliverySchedule ds) {
        return new DeliveryScheduleResponse(
                ds.getId(),
                ds.getTrade().getId(),
                ds.getDeliveryMonth(),
                ds.getScheduledQuantity(),
                ds.getDeliveredQuantity(),
                ds.getStatus(),
                ds.getDeliveryLocation(),
                ds.getNominationRef()
        );
    }
}
