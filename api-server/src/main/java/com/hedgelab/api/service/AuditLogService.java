package com.hedgelab.api.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hedgelab.api.entity.AuditAction;
import com.hedgelab.api.entity.AuditLog;
import com.hedgelab.api.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepo;
    private final ObjectMapper objectMapper;

    public void log(String entityType, Long entityId, AuditAction action,
                    Object oldValue, Object newValue, String summary) {
        String performedBy = resolvePerformedBy();
        String oldJson = toJson(oldValue);
        String newJson = toJson(newValue);

        AuditLog entry = AuditLog.builder()
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .performedBy(performedBy)
                .performedAt(Instant.now())
                .oldValue(oldJson)
                .newValue(newJson)
                .changeSummary(summary)
                .build();
        auditLogRepo.save(entry);
    }

    public void log(String entityType, Long entityId, AuditAction action, String summary) {
        log(entityType, entityId, action, null, null, summary);
    }

    private String resolvePerformedBy() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            return auth.getName();
        }
        return "system";
    }

    private String toJson(Object value) {
        if (value == null) return null;
        if (value instanceof String s) return s;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            log.warn("Could not serialize audit value: {}", e.getMessage());
            return value.toString();
        }
    }
}
