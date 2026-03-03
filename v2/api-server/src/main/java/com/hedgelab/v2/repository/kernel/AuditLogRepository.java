package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.AuditLogEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLogEntry, Long> {
    List<AuditLogEntry> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId, Pageable pageable);
    List<AuditLogEntry> findByModuleOrderByCreatedAtDesc(String module, Pageable pageable);
    List<AuditLogEntry> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
