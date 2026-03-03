package com.hedgelab.v2.repository.kernel;

import com.hedgelab.v2.entity.kernel.EventLogEntry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EventLogRepository extends JpaRepository<EventLogEntry, Long> {
    List<EventLogEntry> findByEventTypeOrderByCreatedAtDesc(String eventType, Pageable pageable);
    List<EventLogEntry> findBySourceModuleOrderByCreatedAtDesc(String sourceModule, Pageable pageable);
    List<EventLogEntry> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, String entityId, Pageable pageable);
    List<EventLogEntry> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
