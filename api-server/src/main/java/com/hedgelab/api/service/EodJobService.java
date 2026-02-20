package com.hedgelab.api.service;

import com.hedgelab.api.entity.AuditAction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * End-of-day batch jobs for the HedgeLab platform.
 * Cron expressions are configured in application.yml under hedgelab.scheduling.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EodJobService {

    private final ValuationService valuationService;
    private final RiskService riskService;
    private final AuditLogService auditLogService;

    @Value("${hedgelab.scheduling.timezone:America/New_York}")
    private String timezone;

    /**
     * EOD mark-to-market valuation — runs at 17:00 ET Mon-Fri.
     */
    @Scheduled(cron = "${hedgelab.scheduling.eod-cron}", zone = "${hedgelab.scheduling.timezone}")
    public Map<String, Object> runEodValuation() {
        return runEodValuationForDate(LocalDate.now());
    }

    public Map<String, Object> runEodValuationForDate(LocalDate date) {
        log.info("[EOD] Starting EOD valuation for {}", date);
        Instant start = Instant.now();
        int count;
        try {
            count = valuationService.runEodValuation(date);
            log.info("[EOD] EOD valuation complete — {} trades valuated", count);
            auditLogService.log("System", null, AuditAction.SCHEDULE_RUN, null, null,
                    "EOD valuation for " + date + " — " + count + " trades");
        } catch (Exception e) {
            log.error("[EOD] EOD valuation failed for {}: {}", date, e.getMessage(), e);
            throw e;
        }
        return Map.of(
                "jobName", "eod-valuation",
                "date", date.toString(),
                "startedAt", start.toString(),
                "tradesValuated", count
        );
    }

    /**
     * Credit utilization recalculation — runs at 17:30 ET Mon-Fri.
     */
    @Scheduled(cron = "${hedgelab.scheduling.credit-recalc-cron}", zone = "${hedgelab.scheduling.timezone}")
    public Map<String, Object> runCreditRecalc() {
        return runCreditRecalcForDate(LocalDate.now());
    }

    public Map<String, Object> runCreditRecalcForDate(LocalDate date) {
        log.info("[EOD] Starting credit utilization recalculation for {}", date);
        Instant start = Instant.now();
        int count;
        try {
            count = riskService.recalculateAllCreditUtilizations(date);
            log.info("[EOD] Credit recalc complete — {} counterparties processed", count);
            auditLogService.log("System", null, AuditAction.SCHEDULE_RUN, null, null,
                    "Credit recalc for " + date + " — " + count + " counterparties");
        } catch (Exception e) {
            log.error("[EOD] Credit recalc failed for {}: {}", date, e.getMessage(), e);
            throw e;
        }
        return Map.of(
                "jobName", "credit-recalc",
                "date", date.toString(),
                "startedAt", start.toString(),
                "counterpartiesProcessed", count
        );
    }

    /**
     * P&L snapshot — runs at 18:00 ET Mon-Fri.
     */
    @Scheduled(cron = "${hedgelab.scheduling.pnl-snapshot-cron}", zone = "${hedgelab.scheduling.timezone}")
    public Map<String, Object> runPnlSnapshot() {
        return runPnlSnapshotForDate(LocalDate.now());
    }

    public Map<String, Object> runPnlSnapshotForDate(LocalDate date) {
        log.info("[EOD] Starting P&L snapshot for {}", date);
        Instant start = Instant.now();
        try {
            valuationService.createPnlSnapshot(date);
            log.info("[EOD] P&L snapshot complete for {}", date);
            auditLogService.log("System", null, AuditAction.SCHEDULE_RUN, null, null,
                    "P&L snapshot for " + date);
        } catch (Exception e) {
            log.error("[EOD] P&L snapshot failed for {}: {}", date, e.getMessage(), e);
            throw e;
        }
        return Map.of(
                "jobName", "pnl-snapshot",
                "date", date.toString(),
                "startedAt", start.toString(),
                "status", "completed"
        );
    }
}
