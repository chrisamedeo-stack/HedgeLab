package com.hedgelab.api.repository;

import com.hedgelab.api.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByEntityTypeAndEntityIdOrderByPerformedAtDesc(String entityType, Long entityId, Pageable pageable);
    Page<AuditLog> findByPerformedByOrderByPerformedAtDesc(String performedBy, Pageable pageable);
    Page<AuditLog> findByEntityTypeOrderByPerformedAtDesc(String entityType, Pageable pageable);
    Page<AuditLog> findByPerformedAtBetweenOrderByPerformedAtDesc(Instant from, Instant to, Pageable pageable);
}
