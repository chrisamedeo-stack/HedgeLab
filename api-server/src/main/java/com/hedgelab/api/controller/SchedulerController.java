package com.hedgelab.api.controller;

import com.hedgelab.api.service.EodJobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/scheduler")
@RequiredArgsConstructor
@Tag(name = "Scheduler", description = "Manual triggers for EOD batch jobs")
@PreAuthorize("hasRole('ADMIN')")
public class SchedulerController {

    private final EodJobService eodJobService;

    @PostMapping("/eod-valuation/trigger")
    @Operation(summary = "Manually trigger EOD mark-to-market valuation")
    public Map<String, Object> triggerEodValuation(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return eodJobService.runEodValuationForDate(date != null ? date : LocalDate.now());
    }

    @PostMapping("/credit-recalc/trigger")
    @Operation(summary = "Manually trigger credit utilization recalculation")
    public Map<String, Object> triggerCreditRecalc(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return eodJobService.runCreditRecalcForDate(date != null ? date : LocalDate.now());
    }

    @PostMapping("/pnl-snapshot/trigger")
    @Operation(summary = "Manually trigger P&L snapshot")
    public Map<String, Object> triggerPnlSnapshot(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return eodJobService.runPnlSnapshotForDate(date != null ? date : LocalDate.now());
    }
}
