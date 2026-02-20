package com.hedgelab.api.controller;

import com.hedgelab.api.dto.request.RecordDeliveryRequest;
import com.hedgelab.api.dto.response.DeliveryScheduleResponse;
import com.hedgelab.api.service.DeliveryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/deliveries")
@RequiredArgsConstructor
@Tag(name = "Deliveries", description = "Delivery schedule management and recording")
public class DeliveryController {

    private final DeliveryService deliveryService;

    @PostMapping("/{id}/mark")
    @Operation(summary = "Record a (partial or full) delivery against a schedule")
    public DeliveryScheduleResponse markDelivery(@PathVariable Long id,
                                                  @Valid @RequestBody RecordDeliveryRequest req,
                                                  @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return deliveryService.markDelivery(id, req, performedBy);
    }

    @PostMapping("/{id}/cancel")
    @Operation(summary = "Cancel a delivery schedule")
    public DeliveryScheduleResponse cancelDelivery(@PathVariable Long id,
                                                    @AuthenticationPrincipal UserDetails user) {
        String performedBy = user != null ? user.getUsername() : "system";
        return deliveryService.cancelDelivery(id, performedBy);
    }

    @GetMapping("/trade/{tradeId}")
    @Operation(summary = "Get all delivery schedules for a trade")
    public List<DeliveryScheduleResponse> getByTrade(@PathVariable Long tradeId) {
        return deliveryService.getByTrade(tradeId);
    }
}
