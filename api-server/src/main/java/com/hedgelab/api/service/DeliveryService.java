package com.hedgelab.api.service;

import com.hedgelab.api.dto.request.RecordDeliveryRequest;
import com.hedgelab.api.dto.response.DeliveryScheduleResponse;
import com.hedgelab.api.entity.*;
import com.hedgelab.api.exception.InvalidStateException;
import com.hedgelab.api.exception.ResourceNotFoundException;
import com.hedgelab.api.repository.DeliveryScheduleRepository;
import com.hedgelab.api.repository.TradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DeliveryService {

    private final DeliveryScheduleRepository deliveryRepo;
    private final TradeRepository tradeRepo;
    private final AuditLogService auditLogService;

    @Transactional
    public DeliveryScheduleResponse markDelivery(Long scheduleId, RecordDeliveryRequest req, String performedBy) {
        DeliverySchedule schedule = findById(scheduleId);

        if (schedule.getStatus() == DeliveryStatus.COMPLETE || schedule.getStatus() == DeliveryStatus.CANCELLED) {
            throw new InvalidStateException("Cannot record delivery for schedule with status: " + schedule.getStatus());
        }

        BigDecimal currentDelivered = schedule.getDeliveredQuantity() != null
                ? schedule.getDeliveredQuantity() : BigDecimal.ZERO;
        BigDecimal newTotal = currentDelivered.add(req.deliveredQuantity());

        if (newTotal.compareTo(schedule.getScheduledQuantity()) > 0) {
            throw new InvalidStateException(
                    "Total delivered quantity (" + newTotal + ") would exceed scheduled quantity ("
                    + schedule.getScheduledQuantity() + ")");
        }

        DeliveryStatus oldStatus = schedule.getStatus();
        schedule.setDeliveredQuantity(newTotal);

        if (newTotal.compareTo(schedule.getScheduledQuantity()) >= 0) {
            schedule.setStatus(DeliveryStatus.COMPLETE);
        } else {
            schedule.setStatus(DeliveryStatus.PARTIAL);
        }

        DeliverySchedule saved = deliveryRepo.save(schedule);

        // Update parent trade delivery status
        propagateToTrade(saved.getTrade());

        auditLogService.log("DeliverySchedule", scheduleId, AuditAction.DELIVER,
                Map.of("status", oldStatus.name(), "deliveredQty", currentDelivered),
                Map.of("status", saved.getStatus().name(), "deliveredQty", newTotal),
                "Delivery recorded by " + performedBy + ": " + req.deliveredQuantity() + " units");
        return DeliveryScheduleResponse.from(saved);
    }

    @Transactional
    public DeliveryScheduleResponse cancelDelivery(Long scheduleId, String performedBy) {
        DeliverySchedule schedule = findById(scheduleId);
        if (schedule.getStatus() == DeliveryStatus.COMPLETE) {
            throw new InvalidStateException("Cannot cancel a completed delivery schedule");
        }
        DeliveryStatus oldStatus = schedule.getStatus();
        schedule.setStatus(DeliveryStatus.CANCELLED);
        DeliverySchedule saved = deliveryRepo.save(schedule);

        auditLogService.log("DeliverySchedule", scheduleId, AuditAction.STATE_CHANGE,
                Map.of("status", oldStatus.name()), Map.of("status", "CANCELLED"),
                "Delivery schedule cancelled by " + performedBy);
        return DeliveryScheduleResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<DeliveryScheduleResponse> getByTrade(Long tradeId) {
        return deliveryRepo.findByTradeIdOrderByDeliveryMonthAsc(tradeId).stream()
                .map(DeliveryScheduleResponse::from)
                .toList();
    }

    private void propagateToTrade(Trade trade) {
        List<DeliverySchedule> schedules = deliveryRepo.findByTradeIdOrderByDeliveryMonthAsc(trade.getId());
        long completeCount = schedules.stream().filter(s -> s.getStatus() == DeliveryStatus.COMPLETE).count();
        long partialCount = schedules.stream().filter(s -> s.getStatus() == DeliveryStatus.PARTIAL).count();
        long activeCount = schedules.stream()
                .filter(s -> s.getStatus() != DeliveryStatus.CANCELLED).count();

        if (completeCount == activeCount && activeCount > 0) {
            trade.setStatus(TradeStatus.FULLY_DELIVERED);
        } else if (completeCount > 0 || partialCount > 0) {
            trade.setStatus(TradeStatus.PARTIALLY_DELIVERED);
        }
        tradeRepo.save(trade);
    }

    private DeliverySchedule findById(Long id) {
        return deliveryRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DeliverySchedule", id));
    }
}
