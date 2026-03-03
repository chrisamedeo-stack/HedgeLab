package com.hedgelab.v2.controller.kernel;

import com.hedgelab.v2.entity.kernel.AuditLogEntry;
import com.hedgelab.v2.service.kernel.AuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v2/kernel/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    public List<AuditLogEntry> list(
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String module,
            @RequestParam(defaultValue = "50") int limit) {
        return auditService.query(entityType, entityId, module, limit);
    }
}
