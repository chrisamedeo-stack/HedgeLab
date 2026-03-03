package com.hedgelab.v2.service.kernel;

import com.hedgelab.v2.entity.kernel.EventLogEntry;
import com.hedgelab.v2.repository.kernel.EventLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventBusService {

    private final EventLogRepository eventLogRepository;

    public Long emit(String eventType, String sourceModule, String entityType,
                     String entityId, Map<String, Object> payload, UUID orgId, UUID userId) {
        EventLogEntry entry = EventLogEntry.builder()
                .eventType(eventType)
                .sourceModule(sourceModule)
                .entityType(entityType)
                .entityId(entityId)
                .payload(payload != null ? payload : Map.of())
                .orgId(orgId)
                .userId(userId)
                .build();
        EventLogEntry saved = eventLogRepository.save(entry);
        log.debug("Event emitted: {} from {} (id={})", eventType, sourceModule, saved.getId());
        return saved.getId();
    }

    public List<EventLogEntry> query(String eventType, String sourceModule,
                                     String entityType, String entityId, int limit) {
        int effectiveLimit = Math.min(Math.max(limit, 1), 200);
        PageRequest page = PageRequest.of(0, effectiveLimit);

        if (eventType != null) {
            return eventLogRepository.findByEventTypeOrderByCreatedAtDesc(eventType, page);
        }
        if (sourceModule != null) {
            return eventLogRepository.findBySourceModuleOrderByCreatedAtDesc(sourceModule, page);
        }
        if (entityType != null && entityId != null) {
            return eventLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId, page);
        }
        return eventLogRepository.findAllByOrderByCreatedAtDesc(page);
    }

    // Event type constants
    public static final String TRADE_CREATED = "TRADE_CREATED";
    public static final String TRADE_UPDATED = "TRADE_UPDATED";
    public static final String TRADE_CANCELLED = "TRADE_CANCELLED";
    public static final String POSITION_ALLOCATED = "POSITION_ALLOCATED";
    public static final String POSITION_DEALLOCATED = "POSITION_DEALLOCATED";
    public static final String EFP_EXECUTED = "EFP_EXECUTED";
    public static final String POSITION_OFFSET = "POSITION_OFFSET";
    public static final String POSITION_ROLLED = "POSITION_ROLLED";
    public static final String PHYSICAL_POSITION_CREATED = "PHYSICAL_POSITION_CREATED";
    public static final String PRICE_UPDATED = "PRICE_UPDATED";
    public static final String IMPORT_COMMITTED = "IMPORT_COMMITTED";
}
