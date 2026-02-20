package com.hedgelab.api.controller;

import com.hedgelab.api.dto.response.AuditLogResponse;
import com.hedgelab.api.repository.AuditLogRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','RISK_MANAGER')")
@Tag(name = "Audit", description = "Audit log query endpoints")
public class AuditController {

    private final AuditLogRepository auditLogRepo;

    @GetMapping
    @Operation(summary = "List audit log entries with optional filters")
    public Page<AuditLogResponse> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) Long entityId,
            @RequestParam(required = false) String performedBy,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @PageableDefault(size = 50, sort = "performedAt") Pageable pageable) {

        if (entityType != null && entityId != null) {
            return auditLogRepo.findByEntityTypeAndEntityIdOrderByPerformedAtDesc(entityType, entityId, pageable)
                    .map(AuditLogResponse::from);
        }
        if (entityType != null) {
            return auditLogRepo.findByEntityTypeOrderByPerformedAtDesc(entityType, pageable)
                    .map(AuditLogResponse::from);
        }
        if (performedBy != null) {
            return auditLogRepo.findByPerformedByOrderByPerformedAtDesc(performedBy, pageable)
                    .map(AuditLogResponse::from);
        }
        if (from != null && to != null) {
            Instant fromInstant = from.atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
            Instant toInstant = to.plusDays(1).atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
            return auditLogRepo.findByPerformedAtBetweenOrderByPerformedAtDesc(fromInstant, toInstant, pageable)
                    .map(AuditLogResponse::from);
        }
        return auditLogRepo.findAll(pageable).map(AuditLogResponse::from);
    }
}
