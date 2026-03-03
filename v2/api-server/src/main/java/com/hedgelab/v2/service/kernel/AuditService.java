package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.AuditLogEntry;
import com.hedgelab.v2.repository.kernel.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void log(UUID orgId, UUID userId, String module, String entityType,
                    String entityId, String action, Map<String, Object> before,
                    Map<String, Object> after, String source, String notes) {
        AuditLogEntry entry = AuditLogEntry.builder()
                .orgId(orgId)
                .userId(userId)
                .module(module)
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .beforeSnapshot(before)
                .afterSnapshot(after)
                .source(source != null ? source : "api")
                .notes(notes)
                .build();
        auditLogRepository.save(entry);
    }

    public List<AuditLogEntry> query(String entityType, String entityId, String module, int limit) {
        int effectiveLimit = Math.min(Math.max(limit, 1), 200);
        PageRequest page = PageRequest.of(0, effectiveLimit);

        if (entityType != null && entityId != null) {
            return auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId, page);
        }
        if (module != null) {
            return auditLogRepository.findByModuleOrderByCreatedAtDesc(module, page);
        }
        return auditLogRepository.findAllByOrderByCreatedAtDesc(page);
    }
}
