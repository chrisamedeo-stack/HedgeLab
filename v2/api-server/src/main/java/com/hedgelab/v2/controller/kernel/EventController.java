package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.EventLogEntry;
import com.hedgelab.v2.service.kernel.EventBusService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/kernel/events")
@RequiredArgsConstructor
public class EventController {

    private final EventBusService eventBusService;

    @GetMapping
    public List<EventLogEntry> list(
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String sourceModule,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(defaultValue = "50") int limit) {
        return eventBusService.query(eventType, sourceModule, entityType, entityId, limit);
    }
}
