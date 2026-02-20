package com.hedgelab.api.dto.response;

import com.hedgelab.api.entity.AuditAction;
import com.hedgelab.api.entity.AuditLog;

import java.time.Instant;

public record AuditLogResponse(
        Long id,
        String entityType,
        Long entityId,
        AuditAction action,
        String performedBy,
        Instant performedAt,
        String oldValue,
        String newValue,
        String changeSummary
) {
    public static AuditLogResponse from(AuditLog log) {
        return new AuditLogResponse(
                log.getId(),
                log.getEntityType(),
                log.getEntityId(),
                log.getAction(),
                log.getPerformedBy(),
                log.getPerformedAt(),
                log.getOldValue(),
                log.getNewValue(),
                log.getChangeSummary()
        );
    }
}
